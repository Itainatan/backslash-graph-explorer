import type { GraphNode, GraphStats, PathQueryResponse } from '@graph-explorer/shared';
import { useState } from 'react';
import type { QueryState } from '../../lib/url-state';
import { QUERY_LIMITS } from '../../lib/url-state';
import { PathCard } from './PathCard';

const PAGE = 100;

interface PathListProps {
  response: PathQueryResponse;
  state: QueryState;
  stats: GraphStats | undefined;
  nodesById: ReadonlyMap<string, GraphNode>;
  dimmed: boolean;
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

function TruncationNotice({ meta, update }: Pick<PathListProps, 'update'> & { meta: PathQueryResponse['meta'] }) {
  const reasons = meta.truncationReasons;
  const canRaiseLimit = reasons.includes('limit') && meta.limit < QUERY_LIMITS.limit.max;
  const canRaiseDepth = reasons.includes('depth') && meta.maxDepth < QUERY_LIMITS.maxDepth.max;
  const text = [
    reasons.includes('limit') && `only the first ${meta.limit} paths are returned`,
    reasons.includes('depth') && `paths longer than ${meta.maxDepth} nodes are not explored`,
    reasons.includes('budget') && 'the search stopped at its traversal limit',
  ].filter(Boolean);
  return (
    <div className="rounded-md border border-caution/30 bg-caution/5 px-3 py-2 text-xs text-muted">
      <p className="text-caution">Some paths may be excluded by the current search limits.</p>
      <p className="mt-0.5">Right now {text.join(', and ')}.</p>
      {(canRaiseLimit || canRaiseDepth) && (
        <button
          type="button"
          onClick={() =>
            update({
              ...(canRaiseLimit ? { limit: QUERY_LIMITS.limit.max } : {}),
              ...(canRaiseDepth ? { maxDepth: QUERY_LIMITS.maxDepth.max } : {}),
            })
          }
          className="mt-1.5 font-medium text-route hover:underline"
        >
          {canRaiseLimit && canRaiseDepth
            ? 'Raise both limits to the maximum'
            : canRaiseLimit
              ? `Show up to ${QUERY_LIMITS.limit.max} paths`
              : `Explore paths up to ${QUERY_LIMITS.maxDepth.max} nodes`}
        </button>
      )}
    </div>
  );
}

export function PathList({ response, state, stats, nodesById, dimmed, selectedPathId, onSelectPath, onNodeClick, update, onReset }: PathListProps) {
  const [shown, setShown] = useState(PAGE);
  // A new result starts from the top again.
  const [prevResponse, setPrevResponse] = useState(response);
  if (response !== prevResponse) {
    setPrevResponse(response);
    setShown(PAGE);
  }

  const { paths, meta } = response;

  if (paths.length === 0) {
    const explanation = state.filters.includes('publicEntry') ? publicReachExplanation(stats) : undefined;
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
        <p className="font-medium">No matching paths found for the selected filters.</p>
        {explanation && <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{explanation}</p>}
        {meta.truncated && <p className="mt-2 text-xs text-muted">The search limits may hide matches; try raising them.</p>}
        <button type="button" onClick={onReset} className="mt-3 text-sm font-medium text-route hover:underline">
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      {meta.truncated && <TruncationNotice meta={meta} update={update} />}
      <ol className="space-y-2" aria-label="Matching paths">
        {paths.slice(0, shown).map((path, i) => (
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
      {shown < paths.length && (
        <button
          type="button"
          onClick={() => setShown((s) => s + PAGE)}
          className="w-full rounded-md border border-line py-2 text-sm text-muted hover:border-line-strong hover:text-text"
        >
          Show {Math.min(PAGE, paths.length - shown)} more of {paths.length - shown} remaining
        </button>
      )}
    </div>
  );
}
