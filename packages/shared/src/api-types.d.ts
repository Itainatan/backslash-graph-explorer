/**
 * REST contract shared by apps/api and apps/web.
 *
 * This is a declaration file on purpose: it cannot contain runtime code, needs no build step,
 * and both apps consume it with `import type`.
 */

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export interface Vulnerability {
  file?: string;
  /** As given in the source data; never invented. */
  severity?: string;
  message?: string;
  /** e.g. `{ cwe }` */
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  /** Equal to `name`; unique. */
  id: string;
  name: string;
  /** Original value, preserved (e.g. `service`, `rds`, `sqs`). */
  kind: string;
  language?: string;
  path?: string;
  /** Missing in the source -> `false`. */
  publicExposed: boolean;
  /** Missing in the source -> `[]`. */
  vulnerabilities: Vulnerability[];
  metadata?: Record<string, unknown>;
  // Derived once at load time:
  /** `kind` is `rds` or `sql` (case-insensitive). */
  isSink: boolean;
  /** In-degree 0. */
  isRoot: boolean;
  /** Out-degree 0. */
  isTerminal: boolean;
}

export interface GraphEdge {
  /** `${source}->${target}` */
  id: string;
  source: string;
  target: string;
}

export type GraphWarningCode = 'DANGLING_EDGE' | 'DUPLICATE_EDGE' | 'SELF_LOOP';

export interface GraphWarning {
  code: GraphWarningCode;
  source: string;
  target: string;
  message: string;
}

/** GET /api/graph */
export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: GraphWarning[];
}

/** GET /api/graph/stats — global, never affected by filters. */
export interface GraphStats {
  nodeCount: number;
  nodeCountByKind: Record<string, number>;
  edgeCount: number;
  rawEdgeCount: number;
  invalidEdgeCount: number;
  duplicateEdgeCount: number;
  publicNodeCount: number;
  vulnerableNodeCount: number;
  vulnerabilityCount: number;
  sinkCount: number;
  rootCount: number;
  completePathCount: number;
  /** `false` if the startup search hit the traversal budget; then the count is a lower bound. */
  completePathCountExact: boolean;
  /** Nodes that appear in no complete path (e.g. inside a cycle with no root and no public node). */
  nodesOnNoPath: number;
  publicReach: PublicReach;
  warnings: GraphWarning[];
}

export interface PublicReach {
  /** Nodes reachable from at least one public node, not counting the public nodes themselves. */
  reachableNodeCount: number;
  /** Vulnerable nodes among the public nodes and everything they reach. */
  vulnerableReachableCount: number;
  /** Whether any sink is among the public nodes or reachable from one. */
  reachesSink: boolean;
}

// ---------------------------------------------------------------------------
// Filters and path queries
// ---------------------------------------------------------------------------

/** GET /api/filters returns these, in registry order. */
export interface FilterDescriptor {
  id: string;
  label: string;
  description: string;
}

/** POST /api/paths/query body. Every field is optional; `{}` returns all complete paths. */
export interface PathQueryRequest {
  /** Registry IDs, combined with AND. */
  filters?: string[];
  /** Maximum nodes in a path (1–30, default 12). */
  maxDepth?: number;
  /** Maximum paths returned (1–500, default 250). */
  limit?: number;
}

export interface PathSummary {
  /** `nodeIds.join('>')` — stable across requests. */
  id: string;
  nodeIds: string[];
  /** Number of nodes. */
  length: number;
  /** Total vulnerability findings across the path's nodes. */
  vulnerabilityCount: number;
  vulnerableNodeIds: string[];
  startsPublic: boolean;
  endsAtSink: boolean;
}

export type TruncationReason = 'limit' | 'depth' | 'budget';

export interface PathQueryMeta {
  returnedCount: number;
  matchedCount: number;
  /** `true` only if the search finished with no depth cutoff and no budget stop. */
  matchedCountExact: boolean;
  truncated: boolean;
  truncationReasons: TruncationReason[];
  cycleDeadEnds: number;
  filters: string[];
  maxDepth: number;
  limit: number;
}

export interface PathQueryResponse {
  paths: PathSummary[];
  /** Nodes and the exact edges traversed by the returned paths, in source order. */
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  meta: PathQueryMeta;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
