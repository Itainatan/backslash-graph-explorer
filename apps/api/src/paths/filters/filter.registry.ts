import { endsAtSinkFilter } from './ends-at-sink.filter';
import type { PathFilter } from './filter.types';
import { hasVulnerabilityFilter } from './has-vulnerability.filter';
import { publicEntryFilter } from './public-entry.filter';

/** Every available filter. Order here is the order of `GET /api/filters` and of the UI toggles. */
export const PATH_FILTERS: readonly PathFilter[] = [publicEntryFilter, endsAtSinkFilter, hasVulnerabilityFilter];

export const PATH_FILTER_IDS: readonly string[] = PATH_FILTERS.map((f) => f.id);

const filtersById = new Map(PATH_FILTERS.map((f) => [f.id, f]));

/** Resolves validated IDs to filters, in registry order. */
export function resolveFilters(ids: readonly string[]): PathFilter[] {
  const requested = new Set(ids);
  const unknown = ids.filter((id) => !filtersById.has(id));
  if (unknown.length > 0) throw new Error(`Unknown filter IDs: ${unknown.join(', ')}`);
  return PATH_FILTERS.filter((f) => requested.has(f.id));
}
