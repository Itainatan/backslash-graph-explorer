import type { GraphNode } from '@graph-explorer/shared';
import { describe, expect, it } from 'vitest';
import { nodeCategory } from '../src/lib/node-category';
import { cweMayNotMatch, sortBySeverity } from '../src/lib/vulnerability';

const node = (overrides: Partial<GraphNode> = {}): GraphNode => ({
  id: 'n',
  name: 'n',
  kind: 'service',
  publicExposed: false,
  vulnerabilities: [],
  isSink: false,
  isRoot: false,
  isTerminal: false,
  ...overrides,
});

describe('nodeCategory', () => {
  it('internal service', () => {
    expect(nodeCategory(node())).toEqual({ base: 'internal', vulnerabilityCount: 0, hasHighSeverity: false, isolated: false });
  });

  it('public and vulnerable at once: public base with a vulnerability overlay', () => {
    const category = nodeCategory(node({ publicExposed: true, vulnerabilities: [{ severity: 'medium' }, { severity: 'HIGH' }] }));
    expect(category).toMatchObject({ base: 'public', vulnerabilityCount: 2, hasHighSeverity: true });
  });

  it('database sink and other infrastructure', () => {
    expect(nodeCategory(node({ kind: 'rds', isSink: true })).base).toBe('sink');
    expect(nodeCategory(node({ kind: 'sqs' })).base).toBe('infrastructure');
  });

  it('isolated when it has no edges at all', () => {
    expect(nodeCategory(node({ isRoot: true, isTerminal: true })).isolated).toBe(true);
    expect(nodeCategory(node({ isRoot: true })).isolated).toBe(false);
  });
});

describe('vulnerability helpers', () => {
  it('sorts high → medium → low → unknown', () => {
    const sorted = sortBySeverity([{ severity: 'low' }, {}, { severity: 'high' }, { severity: 'medium' }]);
    expect(sorted.map((v) => v.severity)).toEqual(['high', 'medium', 'low', undefined]);
  });

  it('flags a SQL message carrying a path-traversal CWE, as in the dataset', () => {
    const cwe = "CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')";
    expect(cweMayNotMatch({ message: 'string concatenation ... in a SQL statement', metadata: { cwe } })).toBe(true);
    expect(cweMayNotMatch({ message: 'File open from tainted variable\n', metadata: { cwe } })).toBe(false);
    expect(cweMayNotMatch({ message: 'SQL injection', metadata: { cwe: 'CWE-89: SQL Injection' } })).toBe(false);
    expect(cweMayNotMatch({ message: 'SQL injection' })).toBe(false);
  });
});
