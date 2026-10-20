import { Inject, Injectable } from '@nestjs/common';
import type {
  GraphNode,
  PathQueryResponse,
  PathSummary,
  TruncationReason,
} from '../api-types';
import { GraphService } from '../graph/graph.service';
import { resolveFilters } from './filters/filter.registry';
import { searchPaths } from './path-search';

export const TRAVERSAL_BUDGET = Symbol('TRAVERSAL_BUDGET');
export const DEFAULT_TRAVERSAL_BUDGET = 50_000;

export interface PathQuery {
  filters: string[];
  maxDepth: number;
  limit: number;
  offset: number;
}

@Injectable()
export class PathQueryService {
  constructor(
    private readonly graphService: GraphService,
    @Inject(TRAVERSAL_BUDGET) private readonly budget: number,
  ) {}

  query({ filters, maxDepth, limit, offset }: PathQuery): PathQueryResponse {
    const graph = this.graphService.graph;
    const active = resolveFilters(filters);
    const result = searchPaths(graph, {
      match: (path) => active.every((f) => f.evaluate(path)),
      maxDepth,
      limit,
      offset,
      budget: this.budget,
    });

    const hasMore = result.matchedCount > offset + result.paths.length;
    const reasons: TruncationReason[] = [];
    if (hasMore) reasons.push('limit');
    if (result.depthCutoff) reasons.push('depth');
    if (result.budgetExceeded) reasons.push('budget');
    const matchedCountExact = !result.depthCutoff && !result.budgetExceeded;

    return {
      paths: result.paths.map(toSummary),
      graph: {
        nodes: graph.nodes.filter((n) => result.matchedNodeIds.has(n.id)),
        edges: graph.edges.filter((e) => result.matchedEdgeIds.has(e.id)),
      },
      meta: {
        returnedCount: result.paths.length,
        matchedCount: result.matchedCount,
        hasMore,
        matchedCountExact,
        truncated: reasons.length > 0,
        truncationReasons: reasons,
        cycleDeadEnds: result.cycleDeadEnds,
        filters: active.map((f) => f.id),
        maxDepth,
        limit,
        offset,
      },
    };
  }
}

function toSummary(path: readonly GraphNode[]): PathSummary {
  const nodeIds = path.map((n) => n.id);
  const vulnerable = path.filter((n) => n.vulnerabilities.length > 0);
  return {
    id: nodeIds.join('>'),
    nodeIds,
    length: path.length,
    vulnerabilityCount: vulnerable.reduce((sum, n) => sum + n.vulnerabilities.length, 0),
    vulnerableNodeIds: vulnerable.map((n) => n.id),
    startsPublic: path[0].publicExposed,
    endsAtSink: path[path.length - 1].isSink,
  };
}
