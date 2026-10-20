import { Inject, Injectable } from '@nestjs/common';
import type { GraphStats } from '../api-types';
import { GraphService } from '../graph/graph.service';
import { TRAVERSAL_BUDGET } from '../paths/path-query.service';
import { computeGraphStats } from './graph-stats';

@Injectable()
export class StatsService {
  /** The graph is static, so stats are computed once at startup and cached. */
  readonly stats: GraphStats;

  constructor(graphService: GraphService, @Inject(TRAVERSAL_BUDGET) budget: number) {
    this.stats = computeGraphStats(graphService.graph, budget);
  }
}
