import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config';
import { GraphModule } from './graph/graph.module';
import { HealthController } from './health/health.controller';
import { DEFAULT_TRAVERSAL_BUDGET, TRAVERSAL_BUDGET } from './paths/path-query.service';
import { PathsModule } from './paths/paths.module';
import { StatsModule } from './stats/stats.module';

export interface AppModuleOptions {
  config: AppConfig;
  /** Node expansions per search; injectable so tests can force a budget stop. */
  traversalBudget?: number;
}

@Global()
@Module({})
export class AppModule {
  static register({ config, traversalBudget = DEFAULT_TRAVERSAL_BUDGET }: AppModuleOptions): DynamicModule {
    const providers = [
      { provide: APP_CONFIG, useValue: config },
      { provide: TRAVERSAL_BUDGET, useValue: traversalBudget },
    ];
    return {
      module: AppModule,
      imports: [GraphModule, PathsModule, StatsModule],
      controllers: [HealthController],
      providers,
      exports: providers,
    };
  }
}
