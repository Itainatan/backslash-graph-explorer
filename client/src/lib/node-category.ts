import type { GraphNode } from '@api-types';

/** One base type per node; public/vulnerable/isolated are overlays because they can combine. */
export type NodeBaseType = 'public' | 'internal' | 'sink' | 'infrastructure';

export interface NodeCategory {
  base: NodeBaseType;
  vulnerabilityCount: number;
  hasHighSeverity: boolean;
  isolated: boolean;
}

export function nodeCategory(node: GraphNode): NodeCategory {
  const base: NodeBaseType = node.isSink
    ? 'sink'
    : node.publicExposed
      ? 'public'
      : node.kind.toLowerCase() === 'service'
        ? 'internal'
        : 'infrastructure';
  return {
    base,
    vulnerabilityCount: node.vulnerabilities.length,
    hasHighSeverity: node.vulnerabilities.some((v) => v.severity?.toLowerCase() === 'high'),
    isolated: node.isRoot && node.isTerminal,
  };
}
