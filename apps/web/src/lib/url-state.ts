/**
 * The URL is the single source of truth for the query. These two pure functions are the only
 * place that knows the URL format.
 */

export type ViewMode = 'full' | 'matching';

export interface QueryState {
  /** Registry IDs, in registry order, de-duplicated. */
  filters: string[];
  maxDepth: number;
  limit: number;
  view: ViewMode;
}

/** Mirrors the API's limits (apps/api/src/paths/dto/path-query.dto.ts). */
export const QUERY_LIMITS = {
  maxDepth: { min: 1, max: 30, default: 12 },
  limit: { min: 1, max: 500, default: 250 },
} as const;

export const DEFAULT_QUERY_STATE: QueryState = {
  filters: [],
  maxDepth: QUERY_LIMITS.maxDepth.default,
  limit: QUERY_LIMITS.limit.default,
  view: 'full',
};

function parseInteger(raw: string | null, { min, max, default: fallback }: { min: number; max: number; default: number }) {
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return value >= min && value <= max ? value : fallback;
}

/** Puts filter IDs in registry order and drops duplicates and unknown IDs. */
export function normalizeFilters(ids: readonly string[], knownFilterIds: readonly string[]): string[] {
  const wanted = new Set(ids);
  return knownFilterIds.filter((id) => wanted.has(id));
}

/** Invalid values fall back to defaults; unknown filter IDs are dropped. */
export function parseQueryState(params: URLSearchParams, knownFilterIds: readonly string[]): QueryState {
  const rawFilters = (params.get('filters') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const view = params.get('view');
  return {
    filters: normalizeFilters(rawFilters, knownFilterIds),
    maxDepth: parseInteger(params.get('maxDepth'), QUERY_LIMITS.maxDepth),
    limit: parseInteger(params.get('limit'), QUERY_LIMITS.limit),
    view: view === 'matching' || view === 'full' ? view : DEFAULT_QUERY_STATE.view,
  };
}

/**
 * Returns the search string without `?`. Defaults are omitted, so equal states always give
 * equal URLs. Commas are left unencoded to keep shared links readable.
 */
export function serializeQueryState(state: QueryState, knownFilterIds: readonly string[]): string {
  const parts: string[] = [];
  const filters = normalizeFilters(state.filters, knownFilterIds);
  if (filters.length > 0) parts.push(`filters=${filters.map(encodeURIComponent).join(',')}`);
  if (state.maxDepth !== DEFAULT_QUERY_STATE.maxDepth) parts.push(`maxDepth=${state.maxDepth}`);
  if (state.limit !== DEFAULT_QUERY_STATE.limit) parts.push(`limit=${state.limit}`);
  if (state.view !== DEFAULT_QUERY_STATE.view) parts.push(`view=${state.view}`);
  return parts.join('&');
}

/** Only the parts of the state that change the API request (not `view`). */
export function toPathQuery({ filters, maxDepth, limit }: QueryState) {
  return { filters, maxDepth, limit };
}
