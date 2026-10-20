import type { GraphWarning } from '@api-types';
import { TriangleAlert, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

const WARNING_TEXT: Record<GraphWarning['code'], string> = {
  DANGLING_EDGE: 'excluded',
  DUPLICATE_EDGE: 'duplicate, ignored',
  SELF_LOOP: 'self-loop, ignored',
};

function DataQualityChip({ warnings }: { warnings: GraphWarning[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const n = warnings.length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-caution/40 bg-caution/10 px-3 py-1 text-xs font-medium text-caution hover:bg-caution/15"
      >
        <TriangleAlert aria-hidden className="size-3.5" />
        <span>
          {n} <span className="max-sm:hidden">{n === 1 ? 'connection' : 'connections'} </span>excluded
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Data quality"
          className="absolute right-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-panel p-4 text-sm shadow-2xl shadow-black/40"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">Connections in the data that point to an undefined service</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted hover:text-text">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {warnings.map((w) => (
              <li key={`${w.code}:${w.source}:${w.target}`} className="rounded border border-line bg-ink px-3 py-2">
                <div className="font-mono text-xs text-text">
                  {w.source} → {w.target}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {w.message}; {WARNING_TEXT[w.code]}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            These connections are left out of every path. The source file is not changed.
          </p>
        </div>
      )}
    </div>
  );
}

export function Header({ warnings }: { warnings: GraphWarning[] | undefined }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Backslash Graph Explorer</h1>
        <span className="hidden text-sm text-muted md:inline">Train Ticket microservices</span>
      </div>
      {warnings && warnings.length > 0 && <DataQualityChip warnings={warnings} />}
    </header>
  );
}
