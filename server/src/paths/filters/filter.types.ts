import type { GraphNode } from '../../api-types';

/**
 * A named, pure, synchronous predicate over a complete path.
 * To add a filter: create one file exporting a `PathFilter` and add it to `PATH_FILTERS`.
 */
export interface PathFilter {
  /** Stable and URL-safe, e.g. `publicEntry`. Used in requests and in the UI URL. */
  id: string;
  label: string;
  description: string;
  evaluate(path: readonly GraphNode[]): boolean;
}
