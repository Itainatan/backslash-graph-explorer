import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadedGraph } from '../src/graph/graph.types';
import { type PathSearchOptions, searchPaths } from '../src/paths/path-search';
import { computeGraphStats } from '../src/stats/graph-stats';
import { buildGraph, completeDag, loadRealGraph } from './fixtures/graphs';

const ALL: PathSearchOptions = { match: () => true, maxDepth: 30, limit: 1000, budget: 50_000 };

const run = (graph: LoadedGraph, options: Partial<PathSearchOptions> = {}) => {
  const result = searchPaths(graph, { ...ALL, ...options });
  return { ...result, ids: result.paths.map((p) => p.map((n) => n.id).join('>')) };
};

describe('searchPaths — semantics on fixture graphs', () => {
  it('linear chain A→B→C gives exactly one path', () => {
    expect(run(buildGraph(['A', 'B', 'C'], { A: ['B'], B: ['C'] })).ids).toEqual(['A>B>C']);
  });

  it('diamond gives two paths, in source order', () => {
    const graph = buildGraph(['A', 'B', 'C', 'D'], { A: ['B', 'C'], B: ['D'], C: ['D'] });
    expect(run(graph).ids).toEqual(['A>B>D', 'A>C>D']);
  });

  it('explores every root', () => {
    const graph = buildGraph(['R1', 'R2', 'T'], { R1: ['T'], R2: ['T'] });
    expect(run(graph).ids).toEqual(['R1>T', 'R2>T']);
  });

  it('an isolated node is a single-node path', () => {
    expect(run(buildGraph(['A', 'B', 'X'], { A: ['B'] })).ids).toEqual(['A>B', 'X']);
  });

  it('a cycle reached from a root terminates, never repeats a node, and counts the dead end', () => {
    const graph = buildGraph(['R', 'A', 'B', 'C'], { R: ['A'], A: ['B'], B: ['C'], C: ['A'] });
    const result = run(graph);
    expect(result.ids).toEqual([]);
    expect(result.cycleDeadEnds).toBe(1);
  });

  it('a cycle with an exit still yields the real route and no repeated node', () => {
    const graph = buildGraph(['R', 'A', 'B', 'T'], { R: ['A'], A: ['B'], B: ['A', 'T'] });
    const result = run(graph);
    expect(result.ids).toEqual(['R>A>B>T']);
    expect(result.cycleDeadEnds).toBe(0);
  });

  it('a root-less cycle terminates with no paths and is reported as nodesOnNoPath', () => {
    const graph = buildGraph(['R', 'T', 'A', 'B', 'C'], { R: ['T'], A: ['B'], B: ['C'], C: ['A'] });
    expect(run(graph).ids).toEqual(['R>T']);
    expect(computeGraphStats(graph, 50_000).nodesOnNoPath).toBe(3);
  });

  it('a public node with an incoming edge is still a start node', () => {
    const graph = buildGraph(['R', { name: 'P', publicExposed: true }, 'T'], { R: ['P'], P: ['T'] });
    expect(run(graph).ids).toEqual(['R>P>T', 'P>T']);
  });

  it('a sink with an outgoing edge ends a path and also continues to longer ones', () => {
    const graph = buildGraph(['A', { name: 'DB', kind: 'rds' }, 'T'], { A: ['DB'], DB: ['T'] });
    expect(run(graph).ids).toEqual(['A>DB', 'A>DB>T']);
  });

  it('is deterministic', () => {
    const graph = loadRealGraph();
    expect(run(graph)).toEqual(run(graph));
  });
});

describe('searchPaths — bounds', () => {
  const chain = buildGraph(['A', 'B', 'C', 'D'], { A: ['B'], B: ['C'], C: ['D'] });

  it('depth limit never emits a partial path and flags the cutoff', () => {
    const result = run(chain, { maxDepth: 3 });
    expect(result.ids).toEqual([]);
    expect(result.depthCutoff).toBe(true);
  });

  it('does not flag a cutoff when the longest path fits exactly', () => {
    const result = run(chain, { maxDepth: 4 });
    expect(result.ids).toEqual(['A>B>C>D']);
    expect(result.depthCutoff).toBe(false);
  });

  it('stores exactly `limit` paths and keeps counting matches', () => {
    const result = run(completeDag(6), { limit: 3 });
    expect(result.paths).toHaveLength(3);
    expect(result.matchedCount).toBe(16);
  });

  it('stops at the budget on a dense graph', () => {
    const result = run(completeDag(15), { budget: 1000 });
    expect(result.budgetExceeded).toBe(true);
    expect(result.matchedCount).toBeLessThan(2 ** 13);
  });

  it('the dense graph completes with a large enough budget', () => {
    const result = run(completeDag(15), { limit: 0, budget: 100_000 });
    expect(result.budgetExceeded).toBe(false);
    expect(result.matchedCount).toBe(2 ** 13);
  });
});

describe('searchPaths — real dataset', () => {
  const graph = loadRealGraph();

  it('finds 220 complete paths with the expected length distribution', () => {
    const result = run(graph);
    expect(result.matchedCount).toBe(220);
    const lengths: Record<number, number> = {};
    for (const p of result.paths) lengths[p.length] = (lengths[p.length] ?? 0) + 1;
    expect(lengths).toEqual({ 1: 5, 2: 18, 3: 61, 4: 80, 5: 44, 6: 12 });
    expect(result.ids[0]).toBe('frontend>admin-basic-info-service>contacts-service');
  });

  it('maxDepth 6 is complete; maxDepth 5 returns 208 and no 5-node prefix', () => {
    expect(run(graph, { maxDepth: 6 })).toMatchObject({ matchedCount: 220, depthCutoff: false });
    const sixNodePrefixes = new Set(
      run(graph).paths.filter((p) => p.length === 6).map((p) => p.slice(0, 5).map((n) => n.id).join('>')),
    );
    const cut = run(graph, { maxDepth: 5 });
    expect(cut).toMatchObject({ matchedCount: 208, depthCutoff: true });
    expect(cut.ids.filter((id) => sixNodePrefixes.has(id))).toEqual([]);
  });
});

describe('architecture', () => {
  it('the engine does not import any concrete filter', () => {
    const source = readFileSync(join(__dirname, '../src/paths/path-search.ts'), 'utf8');
    expect(source).not.toMatch(/from '\.\/filters/);
  });
});
