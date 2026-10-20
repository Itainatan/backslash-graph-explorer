import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { parseQueryState, type QueryState, serializeQueryState } from '../lib/url-state';

/**
 * Reads the query state from the URL and writes it back.
 *
 * - User actions push a history entry, so Back/Forward step through the investigation.
 * - Once the filter registry is known, a non-canonical URL is rewritten once with `replace`.
 * - `ready` is false until the registry is known, so no request is ever sent with unknown IDs.
 */
export function useQueryParams(knownFilterIds: readonly string[] | undefined) {
  const location = useLocation();
  const navigate = useNavigate();
  const ready = knownFilterIds !== undefined;
  const known = useMemo(() => knownFilterIds ?? [], [knownFilterIds]);

  const state = useMemo(() => parseQueryState(new URLSearchParams(location.search), known), [location.search, known]);
  const canonical = serializeQueryState(state, known);
  const current = location.search.replace(/^\?/, '');

  useEffect(() => {
    if (ready && canonical !== current) navigate({ search: canonical }, { replace: true });
  }, [ready, canonical, current, navigate]);

  const update = useCallback(
    (patch: Partial<QueryState>) => {
      const next = serializeQueryState({ ...state, ...patch }, known);
      if (next !== canonical) navigate({ search: next });
    },
    [state, known, canonical, navigate],
  );

  return { state, update, ready, isDefault: canonical === '' };
}
