import type { GraphNode, GraphStats, PathQueryResponse } from '@api-types';
import { Loader2 } from 'lucide-react';
import { PAGE_SIZE } from '../../lib/paging';
import type { QueryState } from '../../lib/url-state';
import { QUERY_LIMITS } from '../../lib/url-state';
import { PathCard } from './PathCard';

interface PathListProps {
  response: PathQueryResponse;
  state: QueryState;
  stats: GraphStats | undefined;
  nodesById: ReadonlyMap<string, GraphNode>;
  dimmed: boolean;
  loadMore: { onLoad: () => void; loading: boolean; failed: boolean };
  selectedPathId: string | undefined;
  onSelectPath: (id: string | undefined) => void;
  onNodeClick: (id: string) => void;
  update: (patch: Partial<QueryState>) => void;
  onReset: () => void;
}

/** Built from the stats, so it stays true if the data changes. */
function publicReachExplanation(stats: GraphStats | undefined): string | undefined {
  if (!stats) return undefined;
  const { reachableNodeCount, vulnerableReachableCount, reachesSink } = stats.publicReach;
  if (vulnerableReachableCount > 0 && reachesSink) return undefined;
  const parts = [
    vulnerableReachableCount === 0 ? 'none is vulnerable' : undefined,
    reachesSink ? undefined : 'none reaches a database',
  ].filter(Boolean);
  return `Public entry points reach ${reachableNodeCount} other ${reachableNodeCount === 1 ? 'service' : 'services'}; ${parts.join(' and ')}.`;
}

/** Depth and budget cuts only; more pages (the `limit` reason) are handled by "Load more". */
function TruncationNotice({ meta, update }: Pick<PathListProps, 'update'> & { meta: PathQueryResponse['meta'] }) {
  const reasons = meta.truncationReasons;
  const canRaiseDepth = reasons.includes('depth') && meta.maxDepth < QUERY_LIMITS.maxDepth.max;
  const text = [
    reasons.includes('depth') && `paths longer than ${meta.maxDepth} nodes are not explored`,
    reasons.includes('budget') && 'the search stopped at its traversal limit',
  ].filter(Boolean);
  return (
    <div className="rounded-md border border-caution/30 bg-caution/5 px-3 py-2 text-xs text-muted">
      <p className="text-caution">Some paths may be excluded by the current search limits.</p>
      <p className="mt-0.5">Right now {text.join(', and ')}.</p>
      {canRaiseDepth && (
        <button
          type="button"
          onClick={() => update({ maxDepth: QUERY_LIMITS.maxDepth.max })}
          className="mt-1.5 font-medium text-route hover:underline"
        >
          Explore paths up to {QUERY_LIMITS.maxDepth.max} nodes
        </button>
      )}
    </div>
  );
}

export function PathList({ response, state, stats, nodesById, dimmed, loadMore, selectedPathId, onSelectPath, onNodeClick, update, onReset }: PathListProps) {
  const { paths, meta } = response;
  const searchCut = meta.truncationReasons.some((r) => r !== 'limit');

  if (paths.length === 0) {
    const explanation = state.filters.includes('publicEntry') ? publicReachExplanation(stats) : undefined;
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
        <p className="font-medium">No matching paths found for the selected filters.</p>
        {explanation && <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{explanation}</p>}
        {searchCut && <p className="mt-2 text-xs text-muted">The search limits may hide matches; try raising them.</p>}
        <button type="button" onClick={onReset} className="mt-3 text-sm font-medium text-route hover:underline">
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      {searchCut && <TruncationNotice meta={meta} update={update} />}
      <ol className="space-y-2" aria-label="Matching paths">
        {paths.map((path, i) => (
          <PathCard
            key={path.id}
            path={path}
            index={i}
            selected={path.id === selectedPathId}
            nodesById={nodesById}
            onSelect={() => onSelectPath(path.id === selectedPathId ? undefined : path.id)}
            onNodeClick={onNodeClick}
          />
        ))}
      </ol>
      {meta.hasMore && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={loadMore.onLoad}
            disabled={loadMore.loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line py-2 text-sm text-muted hover:border-line-strong hover:text-text disabled:cursor-wait"
          >
            {loadMore.loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {loadMore.loading ? 'Loading…' : `Load ${Math.min(PAGE_SIZE, meta.matchedCount - paths.length)} more`}
            <span className="text-faint">
              · {paths.length} of {meta.matchedCount.toLocaleString('en-US')} shown
            </span>
          </button>
          {loadMore.failed && <p className="text-center text-xs text-caution">Could not load more paths. Try again.</p>}
        </div>
      )}
    </div>
  );
}
