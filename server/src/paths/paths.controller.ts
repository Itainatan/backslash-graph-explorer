import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { FilterDescriptor, PathQueryResponse } from '../api-types';
import { PathQueryDto } from './dto/path-query.dto';
import { PATH_FILTERS } from './filters/filter.registry';
import { PathQueryService } from './path-query.service';

@Controller()
export class PathsController {
  constructor(private readonly pathQueryService: PathQueryService) {}

  @Get('filters')
  getFilters(): FilterDescriptor[] {
    return PATH_FILTERS.map(({ id, label, description }) => ({ id, label, description }));
  }

  /** POST because the body is structured and will grow (parameterized filters); nothing is mutated. */
  @Post('paths/query')
  @HttpCode(200)
  query(@Body() dto: PathQueryDto): PathQueryResponse {
    return this.pathQueryService.query(dto);
  }
}
