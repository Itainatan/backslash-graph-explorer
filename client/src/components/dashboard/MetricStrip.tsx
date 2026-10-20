import type { GraphStats } from '@api-types';

interface Metric {
  label: string;
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
    { label: 'Total nodes', value: String(stats.nodeCount), detail: kinds },
    {
      label: 'Valid connections',
      value: String(stats.edgeCount),
      detail: stats.invalidEdgeCount > 0 ? `${stats.invalidEdgeCount} excluded` : undefined,
    },
    {
      label: 'Vulnerable services',
      value: String(stats.vulnerableNodeCount),
      detail: plural(stats.vulnerabilityCount, 'finding'),
      tone: 'finding',
    },
    { label: 'Public services', value: String(stats.publicNodeCount), tone: 'route' },
    { label: 'Database sinks', value: String(stats.sinkCount), tone: 'sink' },
    {
      label: 'Complete paths',
      value: `${stats.completePathCountExact ? '' : '≥'}${stats.completePathCount}`,
      detail: stats.completePathCountExact ? 'Entry point to endpoint' : 'Search limit reached; lower bound',
    },
  ];
}

/** Global figures from /api/graph/stats. They never change with filters. */
export function MetricStrip({ stats }: { stats: GraphStats | undefined }) {
  const metrics = stats ? metricsFrom(stats) : undefined;
  return (
    // The 1px gap over the line colour draws the dividers at any column count.
    <section aria-label="Graph overview" className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {(metrics ?? Array.from({ length: 6 }, () => undefined)).map((metric, i) => (
        <div key={metric?.label ?? i} className="bg-ink px-5 py-3">
          {metric ? (
            <>
              <div className="text-xs text-muted">{metric.label}</div>
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
