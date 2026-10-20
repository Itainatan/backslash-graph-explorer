import dagre from '@dagrejs/dagre';
import type { GraphResponse } from '@api-types';
import { useMemo } from 'react';

export const NODE_WIDTH = 212;
export const NODE_HEIGHT = 44;

export type Positions = ReadonlyMap<string, { x: number; y: number }>;

/** Left-to-right Dagre layout of the full graph, computed once per graph response. */
export function computeLayout(graph: Pick<GraphResponse, 'nodes' | 'edges'>): Positions {
  const g = new dagre.graphlib.Graph();
  // A small edgesep matters most: Dagre routes long edges through spacer nodes, and the default
  // spacing made this graph about 50% taller (fit-to-view zoom 0.35 instead of 0.57).
  g.setGraph({ rankdir: 'LR', nodesep: 10, ranksep: 96, edgesep: 4, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graph.nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of graph.edges) g.setEdge(edge.source, edge.target);
  dagre.layout(g);

  // Dagre returns centre points; React Flow positions are top-left corners.
  return new Map(
    graph.nodes.map((node) => {
      const { x, y } = g.node(node.id);
      return [node.id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }];
    }),
  );
}

export const useGraphLayout = (graph: GraphResponse | undefined): Positions | undefined =>
  useMemo(() => (graph ? computeLayout(graph) : undefined), [graph]);
