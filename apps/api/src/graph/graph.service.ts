import { readFileSync } from 'node:fs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';
import { loadGraph } from './graph.loader';
import { GraphLoadError, type LoadedGraph } from './graph.types';

/** Holds the in-memory graph. Loaded once at startup; a corrupt file fails the boot. */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  readonly graph: LoadedGraph;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.graph = GraphService.readGraphFile(config.dataFile);
    this.logger.log(
      `Loaded ${this.graph.nodes.length} nodes and ${this.graph.edges.length} edges from ${config.dataFile}`,
    );
    for (const w of this.graph.warnings) {
      this.logger.warn(`${w.code}: ${w.source} -> ${w.target} (${w.message})`);
    }
  }

  private static readGraphFile(file: string): LoadedGraph {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new GraphLoadError(`Cannot read graph file ${file}: ${(error as Error).message}`);
    }
    try {
      return loadGraph(raw);
    } catch (error) {
      throw new GraphLoadError(`Invalid graph file ${file}: ${(error as Error).message}`);
    }
  }
}
