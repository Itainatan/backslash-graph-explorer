import { readFileSync } from 'node:fs';
import { loadConfig } from '../../src/config';
import { loadGraph } from '../../src/graph/graph.loader';
import type { LoadedGraph } from '../../src/graph/graph.types';

export interface FixtureNode {
  name: string;
  kind?: string;
  publicExposed?: boolean;
  vulnerabilities?: object[];
}

/** Builds a graph from a compact description: `edges` is `{ A: ['B', 'C'] }`. */
export function buildGraph(nodes: (string | FixtureNode)[], edges: Record<string, string[]> = {}): LoadedGraph {
  return loadGraph({
    nodes: nodes.map((n) => (typeof n === 'string' ? { name: n, kind: 'service' } : { kind: 'service', ...n })),
    edges: Object.entries(edges).map(([from, to]) => ({ from, to })),
  });
}

export const vuln = (severity = 'high') => ({ severity, message: 'test finding' });

export const readRealDataset = (): unknown => JSON.parse(readFileSync(loadConfig({}).dataFile, 'utf8'));

export const loadRealGraph = (): LoadedGraph => loadGraph(readRealDataset());

/** A complete DAG: every node i has an edge to every node j > i. 2^(n-2) root-to-terminal paths. */
export function completeDag(size: number): LoadedGraph {
  const names = Array.from({ length: size }, (_, i) => `n${i}`);
  return buildGraph(names, Object.fromEntries(names.map((name, i) => [name, names.slice(i + 1)])));
}
