import { GraphService } from '../src/graph/graph.service';
import { endsAtSinkFilter } from '../src/paths/filters/ends-at-sink.filter';
import { PATH_FILTERS, resolveFilters } from '../src/paths/filters/filter.registry';
import { hasVulnerabilityFilter } from '../src/paths/filters/has-vulnerability.filter';
import { publicEntryFilter } from '../src/paths/filters/public-entry.filter';
import { DEFAULT_TRAVERSAL_BUDGET, PathQueryService } from '../src/paths/path-query.service';
import { buildGraph, loadRealGraph, vuln } from './fixtures/graphs';

const graph = buildGraph(
  [
    { name: 'pub', publicExposed: true },
    { name: 'pub2', publicExposed: true },
    { name: 'svc' },
    { name: 'bad', vulnerabilities: [vuln()] },
    { name: 'db', kind: 'rds' },
    { name: 'queue', kind: 'sqs' },
  ],
  {},
);
const path = (...ids: string[]) => ids.map((id) => graph.nodesById.get(id)!);

describe('individual filters', () => {
  it('publicEntry checks only the first node', () => {
    expect(publicEntryFilter.evaluate(path('pub', 'svc'))).toBe(true);
    expect(publicEntryFilter.evaluate(path('svc', 'pub2', 'svc'))).toBe(false);
  });

  it('endsAtSink checks only the last node; SQS never matches', () => {
    expect(endsAtSinkFilter.evaluate(path('svc', 'db'))).toBe(true);
    expect(endsAtSinkFilter.evaluate(path('db', 'svc'))).toBe(false);
    expect(endsAtSinkFilter.evaluate(path('svc', 'queue'))).toBe(false);
  });

  it('hasVulnerability matches at any position', () => {
    expect(hasVulnerabilityFilter.evaluate(path('bad', 'svc'))).toBe(true);
    expect(hasVulnerabilityFilter.evaluate(path('svc', 'bad', 'svc'))).toBe(true);
    expect(hasVulnerabilityFilter.evaluate(path('svc', 'bad'))).toBe(true);
    expect(hasVulnerabilityFilter.evaluate(path('svc', 'db'))).toBe(false);
  });
});

describe('filter registry', () => {
  it('has unique IDs in the documented order', () => {
    const ids = PATH_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['publicEntry', 'endsAtSink', 'hasVulnerability']);
  });

  it('resolves to registry order regardless of request order, and rejects unknown IDs', () => {
    expect(resolveFilters(['hasVulnerability', 'publicEntry']).map((f) => f.id)).toEqual(['publicEntry', 'hasVulnerability']);
    expect(() => resolveFilters(['nope'])).toThrow(/Unknown filter IDs: nope/);
  });
});

describe('path query — all 8 filter combinations on the real dataset', () => {
  const service = new PathQueryService({ graph: loadRealGraph() } as GraphService, DEFAULT_TRAVERSAL_BUDGET);
  const query = (filters: string[], overrides = {}) => service.query({ filters, maxDepth: 12, limit: 250, offset: 0, ...overrides });

  it.each`
    publicEntry | endsAtSink | hasVulnerability | paths  | nodes | edges
    ${false}    | ${false}   | ${false}         | ${220} | ${46} | ${96}
    ${true}     | ${false}   | ${false}         | ${6}   | ${8}  | ${6}
    ${false}    | ${true}    | ${false}         | ${30}  | ${21} | ${40}
    ${false}    | ${false}   | ${true}          | ${60}  | ${23} | ${42}
    ${true}     | ${true}    | ${false}         | ${0}   | ${0}  | ${0}
    ${true}     | ${false}   | ${true}          | ${0}   | ${0}  | ${0}
    ${false}    | ${true}    | ${true}          | ${30}  | ${21} | ${40}
    ${true}     | ${true}    | ${true}          | ${0}   | ${0}  | ${0}
  `(
    'publicEntry=$publicEntry endsAtSink=$endsAtSink hasVulnerability=$hasVulnerability → $paths paths',
    ({ publicEntry, endsAtSink, hasVulnerability, paths, nodes, edges }) => {
      const filters = Object.entries({ publicEntry, endsAtSink, hasVulnerability })
        .filter(([, on]) => on)
        .map(([id]) => id);
      const result = query(filters);
      expect(result.paths).toHaveLength(paths);
      expect(result.meta).toMatchObject({ matchedCount: paths, matchedCountExact: true, truncated: false });
      expect(result.graph.nodes).toHaveLength(nodes);
      expect(result.graph.edges).toHaveLength(edges);
    },
  );

  it('the 6 public paths are frontend → admin-basic-info-service → 5 services, plus gateway-service', () => {
    const via = 'frontend>admin-basic-info-service>';
    expect(query(['publicEntry']).paths.map((p) => p.id)).toEqual([
      `${via}contacts-service`,
      `${via}station-service`,
      `${via}train-service`,
      `${via}price-service`,
      `${via}config-service`,
      'gateway-service',
    ]);
  });

  it('every sink path contains a vulnerable node, so sink and sink+vulnerable are identical', () => {
    expect(query(['endsAtSink', 'hasVulnerability']).paths).toEqual(query(['endsAtSink']).paths);
  });

  it('no path ending at prod-sqs counts as a sink path', () => {
    const sinkPaths = query(['endsAtSink']).paths;
    expect(sinkPaths.every((p) => p.nodeIds.at(-1) === 'prod-postgresdb')).toBe(true);
    expect(query([]).paths.some((p) => p.nodeIds.at(-1) === 'prod-sqs')).toBe(true);
  });

  it('never returns the undefined assurance-service', () => {
    const result = query([]);
    expect(result.graph.nodes.map((n) => n.id)).not.toContain('assurance-service');
    expect(result.paths.flatMap((p) => p.nodeIds)).not.toContain('assurance-service');
  });

  it('every response edge is a consecutive pair in at least one matching path, and vice versa', () => {
    for (const filters of [[], ['endsAtSink'], ['hasVulnerability'], ['publicEntry']]) {
      const result = query(filters);
      const traversed = new Set(result.paths.flatMap((p) => p.nodeIds.slice(1).map((id, i) => `${p.nodeIds[i]}->${id}`)));
      expect(new Set(result.graph.edges.map((e) => e.id))).toEqual(traversed);
    }
  });

  it('summarizes paths', () => {
    const [first] = query(['endsAtSink']).paths;
    expect(first).toEqual({
      id: 'admin-user-service>user-service>auth-service>prod-postgresdb',
      nodeIds: ['admin-user-service', 'user-service', 'auth-service', 'prod-postgresdb'],
      length: 4,
      vulnerabilityCount: 1,
      vulnerableNodeIds: ['auth-service'],
      startsPublic: false,
      endsAtSink: true,
    });
  });

  describe('pagination', () => {
    it('pages of 50 joined together equal the full result, in order', () => {
      const full = query([]).paths.map((p) => p.id);
      const pages = [0, 50, 100, 150, 200].map((offset) => query([], { limit: 50, offset }));
      expect(pages.flatMap((page) => page.paths.map((p) => p.id))).toEqual(full);
      expect(pages.map((page) => page.meta.offset)).toEqual([0, 50, 100, 150, 200]);
      expect(pages.map((page) => page.meta.hasMore)).toEqual([true, true, true, true, false]);
      expect(pages.map((page) => page.meta.matchedCount)).toEqual([220, 220, 220, 220, 220]);
    });

    it('every page returns the subgraph of all matches, not just its own paths', () => {
      const full = query(['endsAtSink']).graph;
      expect(query(['endsAtSink'], { limit: 5, offset: 10 }).graph).toEqual(full);
      expect(query(['endsAtSink'], { limit: 5, offset: 10 }).graph.edges).toHaveLength(40);
    });

    it('the last page has no more pages and is not truncated by the limit', () => {
      expect(query([], { limit: 50, offset: 200 }).meta).toMatchObject({
        returnedCount: 20,
        hasMore: false,
        truncated: false,
        truncationReasons: [],
      });
    });

    it('an offset past the end returns no paths but still counts all matches', () => {
      expect(query([], { offset: 500 })).toMatchObject({
        paths: [],
        meta: { returnedCount: 0, matchedCount: 220, hasMore: false, truncated: false },
      });
    });
  });

  describe('truncation', () => {
    it('limit 10, no filters → 10 of 220, reason limit', () => {
      expect(query([], { limit: 10 }).meta).toMatchObject({
        returnedCount: 10,
        matchedCount: 220,
        hasMore: true,
        matchedCountExact: true,
        truncated: true,
        truncationReasons: ['limit'],
      });
    });

    it('limit reached exactly with a complete search is not truncated', () => {
      expect(query(['endsAtSink', 'hasVulnerability'], { limit: 30 }).meta).toMatchObject({
        returnedCount: 30,
        matchedCount: 30,
        truncated: false,
        truncationReasons: [],
      });
    });

    it('maxDepth 6 is complete; maxDepth 5 is cut by depth', () => {
      expect(query([], { maxDepth: 6 }).meta).toMatchObject({ matchedCount: 220, truncated: false });
      expect(query([], { maxDepth: 5 }).meta).toMatchObject({
        returnedCount: 208,
        matchedCount: 208,
        matchedCountExact: false,
        truncated: true,
        truncationReasons: ['depth'],
      });
    });

    it('a budget stop is reported as inexact', () => {
      const tight = new PathQueryService({ graph: loadRealGraph() } as GraphService, 50);
      expect(tight.query({ filters: [], maxDepth: 12, limit: 250, offset: 0 }).meta).toMatchObject({
        matchedCountExact: false,
        truncated: true,
        truncationReasons: ['budget'],
      });
    });
  });
});
