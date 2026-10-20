import type { GraphNode } from '@graph-explorer/shared';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { Database, Globe, Inbox, Server, ShieldAlert } from 'lucide-react';
import { memo } from 'react';
import { NODE_HEIGHT, NODE_WIDTH } from '../../hooks/useGraphLayout';
import type { NodeBaseType, NodeCategory } from '../../lib/node-category';

export type Emphasis = 'normal' | 'focus' | 'dim';

export type ServiceNodeData = {
  node: GraphNode;
  category: NodeCategory;
  emphasis: Emphasis;
  selected: boolean;
};

export type ServiceFlowNode = Node<ServiceNodeData, 'service'>;

export const BASE_STYLE: Record<NodeBaseType, { icon: typeof Server; border: string; iconColor: string }> = {
  public: { icon: Globe, border: 'border-route/80', iconColor: 'text-route' },
  internal: { icon: Server, border: 'border-line-strong', iconColor: 'text-muted' },
  sink: { icon: Database, border: 'border-sink/80', iconColor: 'text-sink' },
  infrastructure: { icon: Inbox, border: 'border-faint border-dashed', iconColor: 'text-muted' },
};

export function subtitle(node: GraphNode, base: NodeBaseType): string {
  switch (base) {
    case 'public':
      return 'Public entry';
    case 'sink':
      return typeof node.metadata?.engine === 'string' ? `Database sink, ${node.metadata.engine}` : 'Database sink';
    case 'infrastructure':
      return node.kind.toUpperCase();
    default:
      return node.language ? `Service, ${node.language}` : 'Service';
  }
}

export function VulnerabilityBadge({ count, high }: { count: number; high: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-semibold leading-4 text-ink ${
        high ? 'bg-critical' : 'bg-finding'
      }`}
    >
      <ShieldAlert aria-hidden className="size-3" strokeWidth={2.5} />
      {count}
      <span className="sr-only">{count === 1 ? 'vulnerability' : 'vulnerabilities'}</span>
    </span>
  );
}

/** Defined at module level (not inside a component) so React Flow never remounts nodes. */
export const ServiceNode = memo(function ServiceNode({ data }: NodeProps<ServiceFlowNode>) {
  const { node, category, emphasis, selected } = data;
  const style = BASE_STYLE[category.base];
  const Icon = style.icon;
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border bg-panel px-3 transition-opacity ${style.border} ${
        emphasis === 'dim' ? 'opacity-20' : ''
      } ${selected ? 'ring-2 ring-route ring-offset-2 ring-offset-ink' : ''} ${emphasis === 'focus' ? 'bg-raised' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line-strong" isConnectable={false} />
      <Icon aria-hidden className={`size-4 shrink-0 ${style.iconColor}`} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium leading-tight text-text" title={node.name}>
          {node.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight text-muted">
          <span className="truncate">{subtitle(node, category.base)}</span>
          {category.isolated && <span className="rounded border border-line-strong px-1 text-[10px] text-faint">Isolated</span>}
        </div>
      </div>
      {category.vulnerabilityCount > 0 && (
        <span className="absolute -right-2 -top-2">
          <VulnerabilityBadge count={category.vulnerabilityCount} high={category.hasHighSeverity} />
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line-strong" isConnectable={false} />
    </div>
  );
});

export const nodeTypes = { service: ServiceNode };
