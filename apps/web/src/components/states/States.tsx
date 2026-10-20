import { CircleAlert, Loader2, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Link } from 'react-router';

export function ErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-critical/40 bg-critical/5 px-4 py-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-critical">
        <CircleAlert aria-hidden className="size-4" />
        {title}
      </p>
      <p className="mt-1 text-muted">{error instanceof Error ? error.message : 'Unknown error.'}</p>
      <RetryButton onRetry={onRetry} />
    </div>
  );
}

export function StaleBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-caution/40 bg-caution/10 px-3 py-2 text-xs text-caution">
      Showing previous results. The update failed.
      <RetryButton onRetry={onRetry} compact />
    </div>
  );
}

function RetryButton({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={`inline-flex items-center gap-1.5 rounded-md border border-line-strong font-medium text-text hover:bg-raised ${
        compact ? 'px-2 py-0.5 text-xs' : 'mt-3 px-3 py-1.5 text-sm'
      }`}
    >
      <RefreshCw aria-hidden className="size-3.5" />
      Retry
    </button>
  );
}

/** Render's free tier sleeps when idle; the first request can take up to a minute. */
export function ColdStartNotice() {
  return (
    <div role="status" className="flex items-center gap-2 rounded-md border border-route/30 bg-route/10 px-3 py-2 text-sm text-route">
      <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
      Waking up the server. This can take up to a minute.
    </div>
  );
}

export function NotFoundPage() {
  return (
    <main className="grid h-full place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">This page does not exist</h1>
        <Link to="/explorer" className="mt-3 inline-block text-route hover:underline">
          Open the graph explorer
        </Link>
      </div>
    </main>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="grid h-full place-items-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-raised"
          >
            Reload the page
          </button>
        </div>
      </main>
    );
  }
}
