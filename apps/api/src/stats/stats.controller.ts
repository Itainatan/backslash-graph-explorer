import { Controller, Get } from '@nestjs/common';
import type { GraphStats } from '@graph-explorer/shared';
import { StatsService } from './stats.service';

@Controller('graph/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats(): GraphStats {
    return this.statsService.stats;
  }
}
