import type { PathQueryResponse, PathSummary } from '@api-types';
import { describe, expect, it } from 'vitest';
import { mergePages, nextPageOffset } from '../src/lib/paging';

const path = (id: string): PathSummary => ({
  id,
  nodeIds: id.split('>'),
  length: id.split('>').length,
  vulnerabilityCount: 0,
  vulnerableNodeIds: [],
  startsPublic: false,
  endsAtSink: false,
});

const page = (ids: string[], meta: Partial<PathQueryResponse['meta']>): PathQueryResponse => ({
  paths: ids.map(path),
  graph: { nodes: [], edges: [{ id: 'A->B', source: 'A', target: 'B' }] },
  meta: {
    returnedCount: ids.length,
    matchedCount: 5,
    hasMore: false,
    matchedCountExact: true,
    truncated: false,
    truncationReasons: [],
    cycleDeadEnds: 0,
    filters: [],
    maxDepth: 12,
    limit: 2,
    offset: 0,
    ...meta,
  },
});

describe('nextPageOffset', () => {
  it('starts the next page right after this one', () => {
    expect(nextPageOffset(page(['A>B', 'A>C'], { offset: 2, hasMore: true }))).toBe(4);
  });

  it('is undefined on the last page', () => {
    expect(nextPageOffset(page(['A>D'], { offset: 4, hasMore: false }))).toBeUndefined();
  });
});

describe('mergePages', () => {
  const pages = [
    page(['A>B', 'A>C'], { offset: 0, hasMore: true, truncated: true, truncationReasons: ['limit'] }),
    page(['A>D'], { offset: 2, hasMore: false }),
  ];

  it('concatenates the paths in order and takes paging state from the last page', () => {
    const merged = mergePages(pages);
    expect(merged.paths.map((p) => p.id)).toEqual(['A>B', 'A>C', 'A>D']);
    expect(merged.meta).toMatchObject({ offset: 0, returnedCount: 3, matchedCount: 5, hasMore: false, truncated: false });
  });

  it('keeps the subgraph of all matches from the first page', () => {
    expect(mergePages(pages).graph).toBe(pages[0].graph);
  });

  it('a single page is returned unchanged', () => {
    expect(mergePages([pages[0]])).toEqual(pages[0]);
  });
});
