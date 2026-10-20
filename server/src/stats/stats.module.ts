import { Module } from '@nestjs/common';
import { PathsModule } from '../paths/paths.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [PathsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
