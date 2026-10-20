import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module';
import { PathQueryService } from './path-query.service';
import { PathsController } from './paths.controller';

@Module({
  imports: [GraphModule],
  controllers: [PathsController],
  providers: [PathQueryService],
  exports: [GraphModule],
})
export class PathsModule {}
