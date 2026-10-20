import type { PathQueryResponse } from '@api-types';

/** Paths requested per page. */
export const PAGE_SIZE = 50;

/** Offset of the page after `page`, or `undefined` when it was the last one. */
export const nextPageOffset = ({ meta }: PathQueryResponse): number | undefined =>
  meta.hasMore ? meta.offset + meta.returnedCount : undefined;

/**
 * Joins loaded pages into one response, so the UI reads the same shape as an unpaged query.
 * Every page carries the subgraph of all matches, so the first page's is used; paging state
 * (`hasMore`, truncation) comes from the last page.
 */
export function mergePages(pages: readonly PathQueryResponse[]): PathQueryResponse {
  if (pages.length === 1) return pages[0];
  const first = pages[0];
  const last = pages[pages.length - 1];
  const paths = pages.flatMap((page) => page.paths);
  return {
    paths,
    graph: first.graph,
    meta: { ...last.meta, offset: first.meta.offset, returnedCount: paths.length },
  };
}
