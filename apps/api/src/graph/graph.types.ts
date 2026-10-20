import type { GraphEdge, GraphNode, GraphWarning } from '@graph-explorer/shared';

/** The normalized, read-only in-memory graph. Everything is in source-file order. */
export interface LoadedGraph {
  nodes: readonly GraphNode[];
  nodesById: ReadonlyMap<string, GraphNode>;
  /** Outgoing neighbours per node, in source order. Every node has an entry, possibly empty. */
  adjacency: ReadonlyMap<string, readonly string[]>;
  inDegree: ReadonlyMap<string, number>;
  /** Valid edges only. */
  edges: readonly GraphEdge[];
  warnings: readonly GraphWarning[];
  /** Directed connections in the source before validation (one per `from`/`to` pair). */
  rawEdgeCount: number;
}

export class GraphLoadError extends Error {
  override readonly name = 'GraphLoadError';
}
