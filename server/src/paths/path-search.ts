import type { GraphNode } from '../api-types';
import type { LoadedGraph } from '../graph/graph.types';

/** A complete path predicate. The engine never knows which filters produced it. */
export type PathPredicate = (path: readonly GraphNode[]) => boolean;

export interface PathSearchOptions {
  match: PathPredicate;
  /** Maximum nodes per path. */
  maxDepth: number;
  /** Matching paths to store, after skipping `offset`; other matches are counted, not stored. */
  limit: number;
  /** Matches to skip before storing (pagination). Default 0. */
  offset?: number;
  /** Maximum node expansions before the search stops. */
  budget: number;
}

export interface PathSearchResult {
  /** Stored matching paths (matches `offset` to `offset + limit - 1`), in deterministic DFS order. */
  paths: GraphNode[][];
  matchedCount: number;
  /** Nodes and edges (`source->target`) of every match found, whatever `offset` and `limit` are. */
  matchedNodeIds: Set<string>;
  matchedEdgeIds: Set<string>;
  /** A path was cut at `maxDepth` while it still had unvisited neighbours. */
  depthCutoff: boolean;
  budgetExceeded: boolean;
  /** Non-end nodes whose every neighbour was already on the path (only possible with cycles). */
  cycleDeadEnds: number;
}

/** Start nodes = roots ∪ public nodes, in source order. */
export const isStartNode = (node: GraphNode): boolean => node.isRoot || node.publicExposed;

/** End nodes = terminals ∪ sinks. */
export const isEndNode = (node: GraphNode): boolean => node.isTerminal || node.isSink;

/**
 * Enumerates complete simple paths (start node -> end node) with a recursive backtracking DFS.
 *
 * - A path is emitted when it reaches an end node; traversal continues past it if it has
 *   outgoing edges (a sink can be called onward), so longer paths are found too.
 * - Path-local visited set: a node is never repeated within one path, so cycles terminate.
 * - Bounded by `maxDepth`, `budget`; `offset` and `limit` only choose what is stored, not what
 *   is counted or collected into the match subgraph.
 */
export function searchPaths(graph: LoadedGraph, options: PathSearchOptions): PathSearchResult {
  const { match, maxDepth, limit, budget, offset = 0 } = options;
  const result: PathSearchResult = {
    paths: [],
    matchedCount: 0,
    matchedNodeIds: new Set(),
    matchedEdgeIds: new Set(),
    depthCutoff: false,
    budgetExceeded: false,
    cycleDeadEnds: 0,
  };
  const path: GraphNode[] = [];
  const onPath = new Set<string>();
  let expansions = 0;

  const visit = (node: GraphNode): void => {
    if (++expansions > budget) {
      result.budgetExceeded = true;
      return;
    }
    path.push(node);
    onPath.add(node.id);

    const isEnd = isEndNode(node);
    if (isEnd && match(path)) {
      if (result.matchedCount >= offset && result.paths.length < limit) result.paths.push([...path]);
      result.matchedCount++;
      path.forEach((n, i) => {
        result.matchedNodeIds.add(n.id);
        if (i > 0) result.matchedEdgeIds.add(`${path[i - 1].id}->${n.id}`);
      });
    }

    const next = graph.adjacency.get(node.id)!.filter((id) => !onPath.has(id));
    if (next.length === 0 && !isEnd) {
      result.cycleDeadEnds++;
    } else if (next.length > 0 && path.length >= maxDepth) {
      result.depthCutoff = true;
    } else {
      for (const id of next) {
        if (result.budgetExceeded) break;
        visit(graph.nodesById.get(id)!);
      }
    }

    onPath.delete(node.id);
    path.pop();
  };

  for (const node of graph.nodes) {
    if (result.budgetExceeded) break;
    if (isStartNode(node)) visit(node);
  }
  return result;
}
