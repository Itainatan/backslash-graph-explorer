import { Controller, Get } from '@nestjs/common';
import type { GraphResponse } from '../api-types';
import { GraphService } from './graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  getGraph(): GraphResponse {
    const { nodes, edges, warnings } = this.graphService.graph;
    return { nodes: [...nodes], edges: [...edges], warnings: [...warnings] };
  }
}
