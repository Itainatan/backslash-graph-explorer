import { ChevronDown, Maximize, Map as MapIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useFilters, useGraph, usePaths, useStats } from '../api/queries';
import { Header } from '../components/dashboard/Header';
import { MetricStrip } from '../components/dashboard/MetricStrip';
import { NodeDrawer } from '../components/details/NodeDrawer';
import { FilterPanel, MatchStatus } from '../components/filters/FilterPanel';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { Legend } from '../components/graph/Legend';
import { PathList } from '../components/paths/PathList';
import { ColdStartNotice, ErrorState, StaleBanner } from '../components/states/States';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { useGraphLayout } from '../hooks/useGraphLayout';
import { useQueryParams } from '../hooks/useQueryParams';
import { DEFAULT_QUERY_STATE, toPathQuery, type ViewMode } from '../lib/url-state';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'full', label: 'Full graph' },
  { id: 'matching', label: 'Matching paths' },
];

export function ExplorerPage() {
  const graphQuery = useGraph();
  const statsQuery = useStats();
  const filtersQuery = useFilters();
  const knownFilterIds = useMemo(() => filtersQuery.data?.map((f) => f.id), [filtersQuery.data]);
  const { state, update, ready, isDefault } = useQueryParams(knownFilterIds);
  const pathsQuery = usePaths(toPathQuery(state), ready);
  const positions = useGraphLayout(graphQuery.data);

  // Local UI state only; everything about the query lives in the URL.
  const [selectedPathId, setSelectedPathId] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);

  const nodesById = useMemo(() => new Map((graphQuery.data?.nodes ?? []).map((n) => [n.id, n])), [graphQuery.data]);
  const stale = pathsQuery.isError && pathsQuery.lastSuccess !== undefined;
  const result = pathsQuery.data ?? (stale ? pathsQuery.lastSuccess : undefined);
  const selectedPath = result?.paths.find((p) => p.id === selectedPathId);
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : undefined;

  // A new result that no longer contains the selected path clears the selection.
  if (selectedPathId && result && !selectedPath) setSelectedPathId(undefined);

  const firstLoad = graphQuery.isPending || statsQuery.isPending || filtersQuery.isPending;
  const slowStart = useDelayedFlag(firstLoad && !graphQuery.isError && !filtersQuery.isError, 3000);

  const reset = useCallback(() => update(DEFAULT_QUERY_STATE), [update]);
  const closeDrawer = useCallback(() => setSelectedNodeId(undefined), []);

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <Header warnings={statsQuery.data?.warnings} />
      <MetricStrip stats={statsQuery.data} />
      {statsQuery.isError && (
        <div className="px-5 pt-3">
          <ErrorState title="Could not load graph statistics" error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />
        </div>
      )}
      {slowStart && (
        <div className="px-5 pt-3">
          <ColdStartNotice />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside aria-label="Investigation" className="flex shrink-0 flex-col border-line max-lg:border-b lg:w-[380px] lg:border-r">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-expanded={sidebarOpen}
            className="flex items-center justify-between px-4 py-3 text-sm font-medium lg:hidden"
          >
            Filters and paths
            <ChevronDown aria-hidden className={`size-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`space-y-6 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${sidebarOpen ? '' : 'max-lg:hidden'}`}>
            {filtersQuery.isError ? (
              <ErrorState title="Could not load filters" error={filtersQuery.error} onRetry={() => void filtersQuery.refetch()} />
            ) : (
              <FilterPanel filters={filtersQuery.data} state={state} ready={ready} isDefault={isDefault} update={update} onReset={reset} />
            )}

            <section aria-label="Matching paths" className="space-y-3 border-t border-line pt-4">
              <MatchStatus meta={result?.meta} fetching={pathsQuery.isFetching && result !== undefined} />
              {stale && <StaleBanner onRetry={() => void pathsQuery.refetch()} />}
              {result ? (
                <PathList
                  response={result}
                  state={state}
                  stats={statsQuery.data}
                  nodesById={nodesById}
                  dimmed={pathsQuery.isPlaceholderData}
                  selectedPathId={selectedPathId}
                  onSelectPath={setSelectedPathId}
                  onNodeClick={setSelectedNodeId}
                  update={update}
                  onReset={reset}
                />
              ) : pathsQuery.isError ? (
                <ErrorState title="Could not load paths" error={pathsQuery.error} onRetry={() => void pathsQuery.refetch()} />
              ) : (
                <div className="space-y-2" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[74px] animate-pulse rounded-lg bg-panel" />
                  ))}
                </div>
              )}
            </section>
          </div>
        </aside>

        {/* React Flow needs a definite height: fixed when stacked, the remaining space on desktop. */}
        <main className="relative flex-1 overflow-hidden max-lg:h-[max(480px,70svh)] max-lg:flex-none">

          <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Graph view" className="flex rounded-md border border-line bg-panel p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={state.view === v.id}
                  onClick={() => update({ view: v.id })}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    state.view === v.id ? 'bg-route text-ink' : 'text-muted hover:text-text'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFitRequest((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-text"
            >
              <Maximize aria-hidden className="size-3.5" />
              Fit to view
            </button>
            <button
              type="button"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:text-text ${
                legendOpen ? 'border-line-strong bg-raised text-text' : 'border-line bg-panel text-muted'
              }`}
            >
              <MapIcon aria-hidden className="size-3.5" />
              Legend
            </button>
          </div>
          {legendOpen && (
            <div className="absolute left-3 top-14 z-10">
              <Legend />
            </div>
          )}

          {graphQuery.data && positions ? (
            <GraphCanvas
              graph={graphQuery.data}
              positions={positions}
              view={state.view}
              matching={result?.graph}
              selectedPath={selectedPath}
              selectedNodeId={selectedNodeId}
              onNodeClick={setSelectedNodeId}
              onPaneClick={closeDrawer}
              fitRequest={fitRequest}
            />
          ) : graphQuery.isError ? (
            <div className="grid h-full place-items-center p-6">
              <ErrorState title="Could not load the graph" error={graphQuery.error} onRetry={() => void graphQuery.refetch()} />
            </div>
          ) : (
            <div aria-hidden className="m-3 mt-16 h-[calc(100%-5rem)] animate-pulse rounded-lg border border-line bg-panel/50" />
          )}

          {state.view === 'matching' && result && result.graph.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="font-medium">No matching paths to show.</p>
                <p className="mt-1 text-sm text-muted">Change the filters, or switch to the full graph.</p>
              </div>
            </div>
          )}

          {selectedNode && graphQuery.data && (
            <NodeDrawer node={selectedNode} graph={graphQuery.data} result={result} onClose={closeDrawer} onNodeClick={setSelectedNodeId} />
          )}
        </main>
      </div>
    </div>
  );
}
