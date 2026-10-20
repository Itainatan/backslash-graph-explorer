import type { FilterDescriptor, PathQueryMeta } from '@api-types';
import { ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { usePathCount } from '../../api/queries';
import { QUERY_LIMITS, type QueryState } from '../../lib/url-state';

interface Preset {
  label: string;
  hint: string;
  filters: string[];
}

/** One-click starting points. Counts come from the API, never hardcoded. */
const PRESETS: Preset[] = [
  { label: 'Vulnerable services reaching the database', hint: 'Ends at a sink and has a vulnerability', filters: ['endsAtSink', 'hasVulnerability'] },
  { label: 'Public entry points', hint: 'Starts at an internet-exposed service', filters: ['publicEntry'] },
  { label: 'Full attack path', hint: 'Public entry, a vulnerability, and a database at the end', filters: ['publicEntry', 'endsAtSink', 'hasVulnerability'] },
];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

function PresetButton({ preset, state, ready, onApply }: { preset: Preset; state: QueryState; ready: boolean; onApply: () => void }) {
  const count = usePathCount(preset.filters, state.maxDepth, ready);
  const active = sameSet(preset.filters, state.filters);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onApply}
      className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        active ? 'border-route/70 bg-route/10' : 'border-line hover:border-line-strong hover:bg-raised'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug">{preset.label}</span>
        <span className="block text-xs text-muted">{preset.hint}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-muted" aria-label={count.data ? `${count.data.count} paths` : undefined}>
        {count.data ? `${count.data.exact ? '' : '≥'}${count.data.count}` : <span className="inline-block h-4 w-5 animate-pulse rounded bg-raised" />}
      </span>
    </button>
  );
}

function FilterSwitch({ filter, checked, onToggle }: { filter: FilterDescriptor; checked: boolean; onToggle: () => void }) {
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={descriptionId}
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-raised"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors ${
          checked ? 'border-route bg-route' : 'border-line-strong bg-ink'
        }`}
      >
        <span className={`size-3.5 rounded-full transition-transform ${checked ? 'translate-x-4 bg-ink' : 'bg-muted'}`} />
      </span>
      <span>
        <span className="block text-[13px] font-medium">{filter.label}</span>
        <span id={descriptionId} className="block text-xs text-muted">
          {filter.description}
        </span>
      </span>
    </button>
  );
}

/** Commits on blur or Enter, not on every keystroke; invalid input reverts. */
function NumberField({ label, value, range, onCommit }: { label: string; value: number; range: { min: number; max: number }; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const id = useId();
  // A new committed value (e.g. Back/Forward) replaces the draft.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }
  const commit = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next >= range.min && next <= range.max) {
      if (next !== value) onCommit(next);
    } else {
      setDraft(String(value));
    }
  };
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="mt-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm focus:border-route"
      />
      <span className="mt-0.5 block text-[11px] text-faint">
        {range.min} to {range.max}
      </span>
    </label>
  );
}

export function MatchStatus({ meta, fetching }: { meta: PathQueryMeta | undefined; fetching: boolean }) {
  if (!meta) return <div className="h-12 w-40 animate-pulse rounded bg-raised" />;
  const n = meta.matchedCount.toLocaleString('en-US');
  const headline = meta.matchedCountExact ? `${n} matching ${meta.matchedCount === 1 ? 'path' : 'paths'}` : `At least ${n} matching paths`;
  let detail = 'Complete search';
  if (meta.truncationReasons.includes('depth')) detail = `Search limited by depth (max ${meta.maxDepth} nodes)`;
  if (meta.truncationReasons.includes('budget')) detail = 'Search stopped at the traversal limit';
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-2 text-base font-semibold">
        {headline}
        {fetching && <Loader2 aria-label="Updating" className="size-4 animate-spin text-muted" />}
      </div>
      <div className="text-xs text-muted">{detail}</div>
    </div>
  );
}

interface FilterPanelProps {
  filters: FilterDescriptor[] | undefined;
  state: QueryState;
  ready: boolean;
  isDefault: boolean;
  update: (patch: Partial<QueryState>) => void;
  onReset: () => void;
}

export function FilterPanel({ filters, state, ready, isDefault, update, onReset }: FilterPanelProps) {
  const toggle = (id: string) =>
    update({ filters: state.filters.includes(id) ? state.filters.filter((f) => f !== id) : [...state.filters, id] });

  return (
    <div className="space-y-5">
      <section aria-labelledby="presets-heading">
        <h2 id="presets-heading" className="mb-2 text-sm font-semibold">
          Suggested investigations
        </h2>
        <div className="space-y-1.5">
          {PRESETS.map((preset) => (
            <PresetButton key={preset.label} preset={preset} state={state} ready={ready} onApply={() => update({ filters: preset.filters })} />
          ))}
        </div>
      </section>

      <section aria-labelledby="filters-heading">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="filters-heading" className="text-sm font-semibold">
            Filters
          </h2>
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="size-3" />
            Reset
          </button>
        </div>
        {filters ? (
          <div className="-mx-2">
            {filters.map((f) => (
              <FilterSwitch key={f.id} filter={f} checked={state.filters.includes(f.id)} onToggle={() => toggle(f.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-raised" />
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-faint">Filters combine with AND: a path must match all of them.</p>

        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-text">
            <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
            Search limits
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <NumberField label="Max nodes per path" value={state.maxDepth} range={QUERY_LIMITS.maxDepth} onCommit={(maxDepth) => update({ maxDepth })} />
          </div>
        </details>
      </section>
    </div>
  );
}
