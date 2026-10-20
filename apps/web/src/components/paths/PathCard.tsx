import type { GraphNode, PathSummary } from '@graph-explorer/shared';
import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { nodeCategory } from '../../lib/node-category';
import { displayMessage, sortBySeverity } from '../../lib/vulnerability';
import { VulnerabilityBadge } from '../graph/ServiceNode';
import { SeverityBadge } from '../details/SeverityBadge';

interface PathCardProps {
  path: PathSummary;
  index: number;
  selected: boolean;
  nodesById: ReadonlyMap<string, GraphNode>;
  onSelect: () => void;
  onNodeClick: (nodeId: string) => void;
}

const STOP_TEXT = { public: 'text-route', sink: 'text-sink', internal: 'text-text', infrastructure: 'text-text' } as const;

/** Rail marker for one stop on the expanded route. */
function StopMarker({ node }: { node: GraphNode }) {
  const category = nodeCategory(node);
  const color = category.vulnerabilityCount > 0
    ? category.hasHighSeverity ? 'border-critical bg-critical' : 'border-finding bg-finding'
    : category.base === 'sink' ? 'border-sink bg-sink'
      : category.base === 'public' ? 'border-route bg-route' : 'border-line-strong bg-ink';
  return <span aria-hidden className={`relative z-10 mt-1 size-3 shrink-0 rounded-full border-2 ${color}`} />;
}

export function PathCard({ path, index, selected, nodesById, onSelect, onNodeClick }: PathCardProps) {
  const detailsId = useId();
  const nodes = path.nodeIds.map((id) => nodesById.get(id)).filter((n): n is GraphNode => n !== undefined);
  const hasHigh = nodes.some((n) => nodeCategory(n).hasHighSeverity);

  return (
    <li className={`rounded-lg border transition-colors ${selected ? 'border-route/70 bg-raised' : 'border-line bg-panel hover:border-line-strong'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-controls={detailsId}
        className="block w-full rounded-lg px-3 py-2.5 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="mt-px shrink-0 text-xs font-medium text-faint">#{index + 1}</span>
          <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
            {nodes.map((node, i) => (
              <span key={node.id}>
                {i > 0 && <ArrowRight aria-label="calls" className="mx-1 inline size-3 text-faint" />}
                <span className={`break-words ${STOP_TEXT[nodeCategory(node).base]} ${node.vulnerabilities.length > 0 ? 'font-semibold text-finding' : ''}`}>
                  {node.name}
                </span>
              </span>
            ))}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6 text-[11px]">
          <span className="text-muted">{path.length === 1 ? 'Isolated node' : `${path.length} nodes`}</span>
          {path.vulnerabilityCount > 0 && <VulnerabilityBadge count={path.vulnerabilityCount} high={hasHigh} />}
          {path.startsPublic && <span className="rounded border border-route/50 px-1.5 text-route">Public entry</span>}
          {path.endsAtSink && <span className="rounded border border-sink/50 px-1.5 text-sink">Ends at sink</span>}
        </div>
      </button>

      {selected && (
        <ol id={detailsId} aria-label="Route steps" className="space-y-3 px-3 pb-3 pl-9">
          {nodes.map((node, i) => (
            <li key={node.id} className="relative -ml-5 flex gap-3">
              {/* Rail segment from this stop's marker down to the next one. */}
              {i < nodes.length - 1 && <span aria-hidden className="absolute -bottom-4 left-[0.3125rem] top-4 w-0.5 bg-route/50" />}
              <StopMarker node={node} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onNodeClick(node.id)}
                  className="text-left text-[13px] font-medium text-text underline-offset-2 hover:underline"
                >
                  {node.name}
                </button>
                <span className="ml-2 text-[11px] text-muted">{node.kind}</span>
                {sortBySeverity(node.vulnerabilities).map((v, i) => (
                  <div key={i} className="mt-1 flex items-start gap-2 text-xs text-muted">
                    <SeverityBadge severity={v.severity} />
                    <span className="min-w-0">{displayMessage(v) ?? 'No description in the data'}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
