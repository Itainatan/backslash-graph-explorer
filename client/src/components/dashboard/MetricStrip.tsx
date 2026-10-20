import type { GraphStats } from '@api-types';
import { Info } from 'lucide-react';
import { useId, useState } from 'react';

interface Metric {
  label: string;
  /** What the figure means, shown from the (i) button. */
  info: string;
  value: string;
  detail?: string;
  tone?: 'finding' | 'route' | 'sink';
}

const TONE = { finding: 'text-finding', route: 'text-route', sink: 'text-sink' };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function metricsFrom(stats: GraphStats): Metric[] {
  const kinds = Object.entries(stats.nodeCountByKind)
    .map(([kind, count]) => (kind === 'service' ? plural(count, 'service') : `${count} ${kind.toUpperCase()}`))
    .join(', ');
  return [
    {
      label: 'Total nodes',
      info: 'Every node in the dataset: the microservices plus the infrastructure they call, such as the database and the message queue.',
      value: String(stats.nodeCount),
      detail: kinds,
    },
    {
      label: 'Valid connections',
      info: 'Directed calls from one node to another. Connections that point to a service missing from the data are excluded and listed in the header warning.',
      value: String(stats.edgeCount),
      detail: stats.invalidEdgeCount > 0 ? `${stats.invalidEdgeCount} excluded` : undefined,
    },
    {
      label: 'Vulnerable services',
      info: 'Services with at least one security finding from the code scanner. The line below counts all findings; one service can have several.',
      value: String(stats.vulnerableNodeCount),
      detail: plural(stats.vulnerabilityCount, 'finding'),
      tone: 'finding',
    },
    {
      label: 'Public services',
      info: 'Services exposed to the internet (publicExposed: true). These are where an attacker can enter.',
      value: String(stats.publicNodeCount),
      tone: 'route',
    },
    {
      label: 'Database sinks',
      info: 'Databases (kind rds or sql) where sensitive data ends up. Other infrastructure, like a message queue, is not a sink.',
      value: String(stats.sinkCount),
      tone: 'sink',
    },
    {
      label: 'Complete paths',
      info: 'Every route from an entry point (a service nothing calls, or a public one) to an endpoint (a service that calls nothing, or a database). Filters do not change this number.',
      value: `${stats.completePathCountExact ? '' : '≥'}${stats.completePathCount}`,
      detail: stats.completePathCountExact ? 'Entry point to endpoint' : 'Search limit reached; lower bound',
    },
  ];
}

/**
 * Explanation for one card. Opens on hover, keyboard focus or tap; closes on leave, blur
 * (tapping elsewhere) or Esc. A click only opens: a tap fires focus and click together.
 */
function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="rounded-full text-faint hover:text-text"
      >
        <Info aria-hidden className="size-3.5" />
      </button>
      {/* Anchored to the card and as wide as it, so it never overflows the page edge. */}
      {open && (
        <div
          id={id}
          role="tooltip"
          className="absolute inset-x-2 top-full z-30 mt-1 rounded-md border border-line-strong bg-raised px-3 py-2 text-xs leading-relaxed text-text shadow-xl shadow-black/40"
        >
          {text}
        </div>
      )}
    </>
  );
}

/** Global figures from /api/graph/stats. They never change with filters. */
export function MetricStrip({ stats }: { stats: GraphStats | undefined }) {
  const metrics = stats ? metricsFrom(stats) : undefined;
  return (
    // The 1px gap over the line colour draws the dividers at any column count.
    <section aria-label="Graph overview" className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {(metrics ?? Array.from({ length: 6 }, () => undefined)).map((metric, i) => (
        <div key={metric?.label ?? i} className="relative bg-ink px-5 py-3">
          {metric ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {metric.label}
                <InfoTip label={metric.label} text={metric.info} />
              </div>
              <div className={`text-2xl font-semibold leading-8 ${metric.tone ? TONE[metric.tone] : 'text-text'}`}>{metric.value}</div>
              <div className="h-4 truncate text-xs text-faint">{metric.detail}</div>
            </>
          ) : (
            <div aria-hidden className="space-y-2 py-0.5">
              <div className="h-3 w-20 animate-pulse rounded bg-raised" />
              <div className="h-6 w-10 animate-pulse rounded bg-raised" />
              <div className="h-3 w-24 animate-pulse rounded bg-raised" />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
