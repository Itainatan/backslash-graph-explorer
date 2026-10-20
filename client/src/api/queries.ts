import type {
  FilterDescriptor,
  GraphResponse,
  GraphStats,
  PathQueryRequest,
  PathQueryResponse,
} from '@api-types';
import { keepPreviousData, QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { mergePages, nextPageOffset, PAGE_SIZE } from '../lib/paging';
import { ApiError, apiFetch } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry once on network or 5xx errors; never on 4xx.
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.isClientError),
      refetchOnWindowFocus: false,
    },
  },
});

/** Graph, stats and filters are static per deploy. */
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export const useGraph = () =>
  useQuery({ queryKey: ['graph'], queryFn: () => apiFetch<GraphResponse>('/api/graph'), ...STATIC });

export const useStats = () =>
  useQuery({ queryKey: ['stats'], queryFn: () => apiFetch<GraphStats>('/api/graph/stats'), ...STATIC });

export const useFilters = () =>
  useQuery({ queryKey: ['filters'], queryFn: () => apiFetch<FilterDescriptor[]>('/api/filters'), ...STATIC });

const fetchPaths = (request: Required<PathQueryRequest>) =>
  apiFetch<PathQueryResponse>('/api/paths/query', { method: 'POST', body: JSON.stringify(request) });

/**
 * The filtered path query, loaded a page at a time; `data` is the loaded pages merged into one
 * response. Keeps showing the previous result while a new one loads, and remembers the last
 * successful result so a failed update can fall back to it.
 */
export function usePaths(request: Pick<Required<PathQueryRequest>, 'filters' | 'maxDepth'>, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ['paths', request],
    queryFn: ({ pageParam }) => fetchPaths({ ...request, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextPageOffset,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    enabled,
  });
  const merged = useMemo(() => query.data && mergePages(query.data.pages), [query.data]);
  const fresh = merged && !query.isPlaceholderData ? merged : undefined;
  const [lastSuccess, setLastSuccess] = useState<PathQueryResponse>();
  if (fresh && fresh !== lastSuccess) setLastSuccess(fresh);
  return { ...query, data: merged, lastSuccess: fresh ?? lastSuccess };
}

/** Match count only (limit 1), used for the suggested-investigation buttons. */
export const usePathCount = (filters: string[], maxDepth: number, enabled: boolean) =>
  useQuery({
    queryKey: ['path-count', { filters, maxDepth }],
    queryFn: () => fetchPaths({ filters, maxDepth, limit: 1, offset: 0 }),
    select: (response) => ({ count: response.meta.matchedCount, exact: response.meta.matchedCountExact }),
    staleTime: Infinity,
    enabled,
  });
