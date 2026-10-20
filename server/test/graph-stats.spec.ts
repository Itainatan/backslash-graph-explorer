import { computeGraphStats } from '../src/stats/graph-stats';
import { buildGraph, completeDag, loadRealGraph, vuln } from './fixtures/graphs';

describe('computeGraphStats', () => {
  it('matches the verified figures for the real dataset', () => {
    const stats = computeGraphStats(loadRealGraph(), 50_000);
    expect(stats).toMatchObject({
      nodeCount: 46,
      nodeCountByKind: { service: 44, rds: 1, sqs: 1 },
      edgeCount: 96,
      rawEdgeCount: 98,
      invalidEdgeCount: 2,
      duplicateEdgeCount: 0,
      publicNodeCount: 2,
      vulnerableNodeCount: 2,
      vulnerabilityCount: 3,
      sinkCount: 1,
      rootCount: 18,
      completePathCount: 220,
      completePathCountExact: true,
      nodesOnNoPath: 0,
      publicReach: { reachableNodeCount: 6, vulnerableReachableCount: 0, reachesSink: false },
    });
    expect(stats.warnings).toHaveLength(2);
  });

  it('public reach counts what the entry points reach, excluding themselves', () => {
    const graph = buildGraph(
      [{ name: 'P', publicExposed: true }, { name: 'V', vulnerabilities: [vuln()] }, { name: 'DB', kind: 'rds' }, 'X'],
      { P: ['V'], V: ['DB'] },
    );
    expect(computeGraphStats(graph, 50_000).publicReach).toEqual({
      reachableNodeCount: 2,
      vulnerableReachableCount: 1,
      reachesSink: true,
    });
  });

  it('marks the complete-path count inexact when the budget runs out', () => {
    expect(computeGraphStats(completeDag(15), 100)).toMatchObject({ completePathCountExact: false });
  });
});
