import type { GraphStats, PublicReach } from '../api-types';
import type { LoadedGraph } from '../graph/graph.types';
import { searchPaths } from '../paths/path-search';

/** Global statistics. Computed once per graph; every value is derived from the normalized graph. */
export function computeGraphStats(graph: LoadedGraph, budget: number): GraphStats {
  const { nodes, warnings } = graph;

  const nodeCountByKind: Record<string, number> = {};
  for (const node of nodes) nodeCountByKind[node.kind] = (nodeCountByKind[node.kind] ?? 0) + 1;

  // Same engine as the query endpoint, no filters, nothing stored.
  const search = searchPaths(graph, {
    match: () => true,
    maxDepth: Number.POSITIVE_INFINITY,
    limit: 0,
    budget,
  });

  const invalidEdgeCount = warnings.filter((w) => w.code === 'DANGLING_EDGE').length;
  const duplicateEdgeCount = warnings.filter((w) => w.code === 'DUPLICATE_EDGE').length;

  return {
    nodeCount: nodes.length,
    nodeCountByKind,
    edgeCount: graph.edges.length,
    rawEdgeCount: graph.rawEdgeCount,
    invalidEdgeCount,
    duplicateEdgeCount,
    publicNodeCount: nodes.filter((n) => n.publicExposed).length,
    vulnerableNodeCount: nodes.filter((n) => n.vulnerabilities.length > 0).length,
    vulnerabilityCount: nodes.reduce((sum, n) => sum + n.vulnerabilities.length, 0),
    sinkCount: nodes.filter((n) => n.isSink).length,
    rootCount: nodes.filter((n) => n.isRoot).length,
    completePathCount: search.matchedCount,
    completePathCountExact: !search.budgetExceeded,
    nodesOnNoPath: nodes.filter((n) => !search.matchedNodeIds.has(n.id)).length,
    publicReach: computePublicReach(graph),
    warnings: [...warnings],
  };
}

/** What an attacker can reach from the internet-exposed services (plain reachability, BFS). */
function computePublicReach(graph: LoadedGraph): PublicReach {
  const entryIds = graph.nodes.filter((n) => n.publicExposed).map((n) => n.id);
  const seen = new Set(entryIds);
  const queue = [...entryIds];
  while (queue.length > 0) {
    for (const next of graph.adjacency.get(queue.shift()!)!) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const exposed = [...seen].map((id) => graph.nodesById.get(id)!);
  return {
    reachableNodeCount: exposed.filter((n) => !n.publicExposed).length,
    vulnerableReachableCount: exposed.filter((n) => n.vulnerabilities.length > 0).length,
    reachesSink: exposed.some((n) => n.isSink),
  };
}
