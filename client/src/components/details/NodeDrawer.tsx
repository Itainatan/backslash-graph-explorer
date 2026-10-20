import type { GraphNode, GraphResponse, PathQueryResponse, Vulnerability } from '@api-types';
import { Check, Copy, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { nodeCategory } from '../../lib/node-category';
import { cweMayNotMatch, cweOf, displayMessage, sortBySeverity } from '../../lib/vulnerability';
import { BASE_STYLE, subtitle } from '../graph/ServiceNode';
import { SeverityBadge } from './SeverityBadge';

interface NodeDrawerProps {
  node: GraphNode;
  graph: GraphResponse;
  /** The current query result, for "in N of the matching paths". */
  result: PathQueryResponse | undefined;
  onClose: () => void;
  onNodeClick: (id: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
      aria-label={copied ? 'Copied' : 'Copy file path'}
      className="shrink-0 rounded p-1 text-muted hover:bg-raised hover:text-text"
    >
      {copied ? <Check className="size-3.5 text-sink" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Finding({ v }: { v: Vulnerability }) {
  const cwe = cweOf(v);
  const message = displayMessage(v);
  return (
    <li className="rounded-md border border-line bg-ink p-3">
      <SeverityBadge severity={v.severity} />
      {message && <p className="mt-2 text-[13px] leading-relaxed">{message}</p>}
      {v.file && (
        <div className="mt-2 flex items-start gap-1 rounded bg-panel px-2 py-1">
          <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-muted">{v.file}</code>
          <CopyButton text={v.file} />
        </div>
      )}
      {cwe && <p className="mt-2 font-mono text-[11px] text-muted">{cwe}</p>}
      {cweMayNotMatch(v) && <p className="mt-1 text-[11px] text-faint">The CWE may not match this description. Shown as given in the data.</p>}
    </li>
  );
}

function NodeChips({ title, ids, onNodeClick }: { title: string; ids: string[]; onNodeClick: (id: string) => void }) {
  return (
    <div>
      <h3 className="text-xs text-muted">
        {title} ({ids.length})
      </h3>
      {ids.length === 0 ? (
        <p className="mt-1 text-xs text-faint">None</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onNodeClick(id)}
              className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-route hover:text-route"
            >
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeDrawer({ node, graph, result, onClose, onNodeClick }: NodeDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const category = nodeCategory(node);
  const { icon: Icon, iconColor } = BASE_STYLE[category.base];

  useEffect(() => closeRef.current?.focus(), [node.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { callers, callees } = useMemo(
    () => ({
      callers: graph.edges.filter((e) => e.target === node.id).map((e) => e.source),
      callees: graph.edges.filter((e) => e.source === node.id).map((e) => e.target),
    }),
    [graph, node.id],
  );

  const inPaths = result?.paths.filter((p) => p.nodeIds.includes(node.id)).length;
  const facts = [
    ['Kind', node.kind],
    ['Language', node.language],
    ['Repository path', node.path],
    ['Internet-exposed', node.publicExposed ? 'Yes' : 'No'],
    ...Object.entries(node.metadata ?? {}).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), String(v)]),
  ].filter((fact): fact is [string, string] => fact[1] !== undefined);

  return (
    <aside
      aria-label={`Details for ${node.name}`}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-line bg-panel shadow-2xl shadow-black/50"
    >
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <Icon aria-hidden className={`mt-1 size-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-semibold">{node.name}</h2>
          <p className="text-xs text-muted">{subtitle(node, category.base)}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details" className="rounded p-1 text-muted hover:bg-raised hover:text-text">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {inPaths !== undefined && result && (
          <p className="text-sm text-muted">
            In <span className="font-semibold text-text">{inPaths}</span> of the {result.meta.returnedCount} {result.meta.truncated ? 'returned' : 'matching'} paths
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>

        {node.vulnerabilities.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-finding">
              {node.vulnerabilities.length} {node.vulnerabilities.length === 1 ? 'vulnerability' : 'vulnerabilities'}
            </h3>
            <ul className="space-y-2">
              {sortBySeverity(node.vulnerabilities).map((v, i) => (
                <Finding key={i} v={v} />
              ))}
            </ul>
          </section>
        )}

        <NodeChips title="Called by" ids={callers} onNodeClick={onNodeClick} />
        <NodeChips title="Calls" ids={callees} onNodeClick={onNodeClick} />
      </div>
    </aside>
  );
}
