import type {
  FilterDescriptor,
  GraphResponse,
  GraphStats,
  PathQueryRequest,
  PathQueryResponse,
} from '@graph-explorer/shared';
import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
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
 * The filtered path query. Keeps showing the previous result while a new one loads, and
 * remembers the last successful result so a failed update can fall back to it.
 */
export function usePaths(request: Required<PathQueryRequest>, enabled: boolean) {
  const query = useQuery({
    queryKey: ['paths', request],
    queryFn: () => fetchPaths(request),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    enabled,
  });
  const lastSuccess = useRef<PathQueryResponse | undefined>(undefined);
  if (query.data && !query.isPlaceholderData) lastSuccess.current = query.data;
  return { ...query, lastSuccess: lastSuccess.current };
}

/** Match count only (limit 1), used for the suggested-investigation buttons. */
export const usePathCount = (filters: string[], maxDepth: number, enabled: boolean) =>
  useQuery({
    queryKey: ['path-count', { filters, maxDepth }],
    queryFn: () => fetchPaths({ filters, maxDepth, limit: 1 }),
    select: (response) => ({ count: response.meta.matchedCount, exact: response.meta.matchedCountExact }),
    staleTime: Infinity,
    enabled,
  });
