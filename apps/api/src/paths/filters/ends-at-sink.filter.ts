import type { PathFilter } from './filter.types';

export const endsAtSinkFilter: PathFilter = {
  id: 'endsAtSink',
  label: 'Ends at a sink',
  description: 'Path ends at a database sink (kind rds or sql)',
  // isSink is derived at load time: kind is rds/sql, case-insensitive. SQS is not a sink.
  evaluate: (path) => path[path.length - 1].isSink,
};
