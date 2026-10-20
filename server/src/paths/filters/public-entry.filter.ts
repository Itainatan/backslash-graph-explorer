import type { PathFilter } from './filter.types';

export const publicEntryFilter: PathFilter = {
  id: 'publicEntry',
  label: 'Public entry',
  description: 'Path starts at an internet-exposed service (publicExposed: true)',
  evaluate: (path) => path[0].publicExposed,
};
