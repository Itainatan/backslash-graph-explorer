import { loadGraph } from '../src/graph/graph.loader';
import { GraphLoadError } from '../src/graph/graph.types';
import { buildGraph, loadRealGraph, readRealDataset } from './fixtures/graphs';

const node = (name: string, extra: object = {}) => ({ name, kind: 'service', ...extra });

describe('loadGraph — real dataset', () => {
  const graph = loadRealGraph();

  it('loads 46 nodes and 96 valid edges, skipping the 2 dangling ones', () => {
    expect(graph.nodes).toHaveLength(46);
    expect(graph.edges).toHaveLength(96);
    expect(graph.rawEdgeCount).toBe(98);
    expect(graph.warnings).toEqual([
      expect.objectContaining({ code: 'DANGLING_EDGE', source: 'preserve-other-service', target: 'assurance-service' }),
      expect.objectContaining({ code: 'DANGLING_EDGE', source: 'preserve-service', target: 'assurance-service' }),
    ]);
    expect(graph.nodesById.has('assurance-service')).toBe(false);
  });

  it('gives every node an adjacency entry and keeps source order', () => {
    expect(graph.adjacency.size).toBe(46);
    expect(graph.adjacency.get('gateway-service')).toEqual([]);
    expect(graph.adjacency.get('auth-service')).toEqual(['verification-code-service', 'prod-postgresdb']);
    expect(graph.nodes[0].id).toBe('frontend');
    expect(graph.edges[0].id).toBe('frontend->admin-basic-info-service');
  });

  it('preserves vulnerability and infrastructure fields exactly as given', () => {
    const order = graph.nodesById.get('order-service')!;
    expect(order.vulnerabilities[0]).toEqual({
      file: 'train-ticket/ts-order-service/src/main/java/order/service/OrderServiceImpl.java',
      severity: 'high',
      message: 'File open from tainted variable\n',
      metadata: { cwe: "CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')" },
    });
    expect(graph.nodesById.get('prod-postgresdb')!.metadata).toEqual({ cloud: 'AWS', engine: 'postgres', version: '9.6' });
  });

  it('derives sink, root, terminal and default flags', () => {
    const db = graph.nodesById.get('prod-postgresdb')!;
    expect(db).toMatchObject({ isSink: true, isTerminal: true, isRoot: false, publicExposed: false, vulnerabilities: [] });
    expect(graph.nodesById.get('prod-sqs')!.isSink).toBe(false);
    expect(graph.nodesById.get('frontend')).toMatchObject({ isRoot: true, publicExposed: true, isSink: false });
    expect(graph.nodes.filter((n) => n.isRoot)).toHaveLength(18);
  });

  it('does not mutate its input', () => {
    const raw = readRealDataset();
    const before = JSON.stringify(raw);
    loadGraph(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe('loadGraph — normalization', () => {
  it('normalizes a string `to` and an array `to` identically', () => {
    const asString = loadGraph({ nodes: [node('A'), node('B')], edges: [{ from: 'A', to: 'B' }] });
    const asArray = loadGraph({ nodes: [node('A'), node('B')], edges: [{ from: 'A', to: ['B'] }] });
    expect(asString.edges).toEqual(asArray.edges);
    expect(asString.edges).toEqual([{ id: 'A->B', source: 'A', target: 'B' }]);
  });

  it('accepts an empty `to: []`', () => {
    const graph = loadGraph({ nodes: [node('A')], edges: [{ from: 'A', to: [] }] });
    expect(graph.edges).toEqual([]);
    expect(graph.warnings).toEqual([]);
  });

  it('treats kind case-insensitively for sinks (RDS, SQL)', () => {
    const graph = buildGraph([{ name: 'db', kind: 'RDS' }, { name: 'sql', kind: 'Sql' }, { name: 'q', kind: 'sqs' }]);
    expect(graph.nodes.map((n) => n.isSink)).toEqual([true, true, false]);
    expect(graph.nodes[0].kind).toBe('RDS');
  });

  it('preserves unknown extra node fields', () => {
    const graph = loadGraph({ nodes: [node('A', { owner: 'team-x' })], edges: [] });
    expect(graph.nodes[0]).toMatchObject({ owner: 'team-x' });
  });
});

describe('loadGraph — skip and warn', () => {
  const nodes = [node('A'), node('B')];

  it.each([
    ['dangling target', { from: 'A', to: 'X' }, 'DANGLING_EDGE', 'Target node is not defined'],
    ['dangling source', { from: 'X', to: 'A' }, 'DANGLING_EDGE', 'Source node is not defined'],
    ['self-loop', { from: 'A', to: 'A' }, 'SELF_LOOP', expect.any(String)],
  ])('%s', (_name, edge, code, message) => {
    const graph = loadGraph({ nodes, edges: [edge] });
    expect(graph.edges).toEqual([]);
    expect(graph.warnings).toEqual([{ code, source: edge.from, target: edge.to, message }]);
  });

  it('duplicate edge keeps the first and warns once', () => {
    const graph = loadGraph({ nodes, edges: [{ from: 'A', to: ['B', 'B'] }, { from: 'A', to: 'B' }] });
    expect(graph.edges).toHaveLength(1);
    expect(graph.inDegree.get('B')).toBe(1);
    expect(graph.warnings.map((w) => w.code)).toEqual(['DUPLICATE_EDGE', 'DUPLICATE_EDGE']);
  });
});

describe('loadGraph — fails on corrupt input', () => {
  it.each<[string, unknown, RegExp]>([
    ['non-object root', [], /root must be a JSON object/],
    ['null root', null, /root must be a JSON object/],
    ['missing nodes', { edges: [] }, /"nodes" must be an array/],
    ['missing edges', { nodes: [] }, /"edges" must be an array/],
    ['missing name', { nodes: [{ kind: 'service' }], edges: [] }, /name must be a non-empty string/],
    ['empty name', { nodes: [node('  ')], edges: [] }, /name must be a non-empty string/],
    ['name containing >', { nodes: [node('a>b')], edges: [] }, /must not contain ">"/],
    ['missing kind', { nodes: [{ name: 'A' }], edges: [] }, /kind must be a non-empty string/],
    ['duplicate name', { nodes: [node('A'), node('A')], edges: [] }, /Duplicate node name "A"/],
    ['non-boolean publicExposed', { nodes: [node('A', { publicExposed: 'true' })], edges: [] }, /publicExposed must be a boolean/],
    ['non-array vulnerabilities', { nodes: [node('A', { vulnerabilities: {} })], edges: [] }, /vulnerabilities must be an array/],
    ['non-string from', { nodes: [node('A')], edges: [{ from: 1, to: 'A' }] }, /from must be a string/],
    ['invalid to type', { nodes: [node('A')], edges: [{ from: 'A', to: 5 }] }, /to must be a string or an array of strings/],
    ['non-string in to array', { nodes: [node('A')], edges: [{ from: 'A', to: ['A', 1] }] }, /to must be a string or an array/],
  ])('%s', (_name, raw, message) => {
    expect(() => loadGraph(raw)).toThrow(GraphLoadError);
    expect(() => loadGraph(raw)).toThrow(message);
  });
});
