import { Database, Globe, Inbox, Server } from 'lucide-react';
import { VulnerabilityBadge } from './ServiceNode';

const NODE_TYPES = [
  { icon: Globe, label: 'Public entry (internet-exposed)', className: 'border-route/80 text-route' },
  { icon: Server, label: 'Internal service', className: 'border-line-strong text-muted' },
  { icon: Database, label: 'Database sink (rds or sql)', className: 'border-sink/80 text-sink' },
  { icon: Inbox, label: 'Other infrastructure, e.g. SQS', className: 'border-dashed border-faint text-muted' },
];

export function Legend() {
  return (
    <div className="w-64 rounded-lg border border-line bg-panel/95 p-3 text-xs text-muted backdrop-blur">
      <ul className="space-y-1.5">
        {NODE_TYPES.map(({ icon: Icon, label, className }) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`grid size-5 place-items-center rounded border bg-ink ${className}`}>
              <Icon aria-hidden className="size-3" />
            </span>
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <VulnerabilityBadge count={2} high={false} />
          Vulnerability findings
        </li>
        <li className="flex items-center gap-2">
          <VulnerabilityBadge count={1} high />
          Includes a high-severity finding
        </li>
        <li className="flex items-center gap-2 pt-1">
          <svg aria-hidden width="20" height="8" className="shrink-0">
            <line x1="0" y1="4" x2="20" y2="4" stroke="var(--color-route)" strokeWidth="2.5" strokeDasharray="5 3" />
          </svg>
          Selected route, in call direction
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded border border-line-strong bg-ink opacity-20">
            <Server aria-hidden className="size-3" />
          </span>
          Faded: not on a matching path
        </li>
        <li className="flex items-center gap-2">
          <span className="rounded border border-line-strong px-1 text-[10px] text-faint">Isolated</span>
          No connections in the data
        </li>
      </ul>
    </div>
  );
}
