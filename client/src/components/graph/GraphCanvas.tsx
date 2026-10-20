import type { GraphResponse, PathQueryResponse, PathSummary } from '@api-types';
import {
  type Edge,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NODE_HEIGHT, NODE_WIDTH, type Positions } from '../../hooks/useGraphLayout';
import { nodeCategory } from '../../lib/node-category';
import type { ViewMode } from '../../lib/url-state';
import { type Emphasis, nodeTypes, type ServiceFlowNode } from './ServiceNode';

interface GraphCanvasProps {
  graph: GraphResponse;
  positions: Positions;
  view: ViewMode;
  /** The current query's subgraph; used by the Matching view. */
  matching: PathQueryResponse['graph'] | undefined;
  selectedPath: PathSummary | undefined;
  selectedNodeId: string | undefined;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  /** Bumped by the toolbar's Fit button. */
  fitRequest: number;
}

const COLORS = {
  idle: '#3d5277',
  hover: '#9fb3d1',
  route: '#6aa8ff',
};

const FIT = { padding: 0.15, duration: 300, maxZoom: 1.2 } as const;

function Canvas({ graph, positions, view, matching, selectedPath, selectedNodeId, onNodeClick, onPaneClick, fitRequest }: GraphCanvasProps) {
  // fitView's identity changes as nodes change; a ref keeps the effects below tied only to
  // their own triggers (otherwise a hover or a selection would re-fit the whole graph).
  const { fitView } = useReactFlow();
  const fitViewRef = useRef(fitView);
  useLayoutEffect(() => {
    fitViewRef.current = fitView;
  });
  const [hoveredId, setHoveredId] = useState<string>();

  const visible = useMemo(() => {
    if (view === 'full' || !matching) return undefined;
    return { nodes: new Set(matching.nodes.map((n) => n.id)), edges: new Set(matching.edges.map((e) => e.id)) };
  }, [view, matching]);

  const route = useMemo(() => {
    if (!selectedPath) return undefined;
    const ids = selectedPath.nodeIds;
    return { nodes: new Set(ids), edges: new Set(ids.slice(1).map((id, i) => `${ids[i]}->${id}`)) };
  }, [selectedPath]);

  // Static per graph: categories never change.
  const categories = useMemo(() => new Map(graph.nodes.map((n) => [n.id, nodeCategory(n)])), [graph]);

  const nodes = useMemo<ServiceFlowNode[]>(
    () =>
      graph.nodes.map((node) => {
        const emphasis: Emphasis = route ? (route.nodes.has(node.id) ? 'focus' : 'dim') : node.id === hoveredId ? 'focus' : 'normal';
        return {
          id: node.id,
          type: 'service',
          position: positions.get(node.id)!,
          // Nodes have a fixed size. Without `measured`, React Flow drops the measured handle positions
          // whenever a node object is recreated (every hover), and all edges vanish for a frame.
          measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
          hidden: visible ? !visible.nodes.has(node.id) : false,
          data: { node, category: categories.get(node.id)!, emphasis, selected: node.id === selectedNodeId },
          ariaLabel: `${node.name}, ${node.kind}`,
        };
      }),
    [graph, positions, visible, route, hoveredId, selectedNodeId, categories],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const onRoute = route?.edges.has(edge.id) ?? false;
        // Without a selected route, the hovered and the selected node both light up their edges.
        const touches = (id: string | undefined) => id !== undefined && (edge.source === id || edge.target === id);
        const hovered = !route && (touches(hoveredId) || touches(selectedNodeId));
        const color = onRoute ? COLORS.route : hovered ? COLORS.hover : COLORS.idle;
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          hidden: visible ? !visible.edges.has(edge.id) : false,
          className: onRoute ? 'edge-on-route' : undefined,
          zIndex: onRoute || hovered ? 1 : 0,
          style: {
            stroke: color,
            strokeWidth: onRoute ? 2.5 : hovered ? 2 : 1.25,
            opacity: route && !onRoute ? 0.2 : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        };
      }),
    [graph, visible, route, hoveredId, selectedNodeId],
  );

  // The `fitView` prop handles the first render; these handle later changes.
  // Fit to what is visible when the view or the matching set changes.
  useEffect(() => {
    const ids = visible ? [...visible.nodes] : undefined;
    if (ids && ids.length === 0) return;
    void fitViewRef.current({ ...FIT, nodes: ids?.map((id) => ({ id })) });
  }, [visible, fitRequest]);

  // Then zoom to the selected route.
  useEffect(() => {
    if (!route) return;
    void fitViewRef.current({ ...FIT, padding: 0.3, nodes: [...route.nodes].map((id) => ({ id })) });
  }, [route]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.15}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.04 }}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
      onNodeMouseLeave={() => setHoveredId(undefined)}
      onPaneClick={onPaneClick}
      colorMode="dark"
    >
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
