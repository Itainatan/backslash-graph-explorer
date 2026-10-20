import type { GraphEdge, GraphNode, GraphWarning, Vulnerability } from '@graph-explorer/shared';
import { GraphLoadError, type LoadedGraph } from './graph.types';

const SINK_KINDS = new Set(['rds', 'sql']);
/** Used as the path-ID separator, so it may not appear in node names. */
const PATH_SEPARATOR = '>';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parses, validates and normalizes the raw graph JSON. Pure: no I/O.
 *
 * Throws `GraphLoadError` for corrupt input (the app must not boot on it).
 * Recoverable edge problems are skipped and reported as warnings.
 */
export function loadGraph(raw: unknown): LoadedGraph {
  if (!isObject(raw)) throw new GraphLoadError('Graph root must be a JSON object');
  if (!Array.isArray(raw.nodes)) throw new GraphLoadError('"nodes" must be an array');
  if (!Array.isArray(raw.edges)) throw new GraphLoadError('"edges" must be an array');

  const parsedNodes = raw.nodes.map(parseNode);
  const nodeIds = new Set<string>();
  for (const node of parsedNodes) {
    if (nodeIds.has(node.id)) throw new GraphLoadError(`Duplicate node name "${node.id}"`);
    nodeIds.add(node.id);
  }

  const adjacency = new Map<string, string[]>(parsedNodes.map((n) => [n.id, []]));
  const inDegree = new Map<string, number>(parsedNodes.map((n) => [n.id, 0]));
  const edges: GraphEdge[] = [];
  const warnings: GraphWarning[] = [];
  let rawEdgeCount = 0;

  raw.edges.forEach((rawEdge, index) => {
    for (const [source, target] of parseEdge(rawEdge, index)) {
      rawEdgeCount++;
      const warning = checkEdge(source, target, nodeIds, adjacency);
      if (warning) {
        warnings.push(warning);
        continue;
      }
      adjacency.get(source)!.push(target);
      inDegree.set(target, inDegree.get(target)! + 1);
      edges.push({ id: `${source}->${target}`, source, target });
    }
  });

  const nodes: GraphNode[] = parsedNodes.map((node) => ({
    ...node,
    isRoot: inDegree.get(node.id) === 0,
    isTerminal: adjacency.get(node.id)!.length === 0,
  }));

  return {
    nodes,
    nodesById: new Map(nodes.map((n) => [n.id, n])),
    adjacency,
    inDegree,
    edges,
    warnings,
    rawEdgeCount,
  };
}

function parseNode(raw: unknown, index: number): Omit<GraphNode, 'isRoot' | 'isTerminal'> {
  const at = `nodes[${index}]`;
  if (!isObject(raw)) throw new GraphLoadError(`${at} must be an object`);

  const { name, kind, publicExposed, vulnerabilities, metadata, language, path } = raw;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new GraphLoadError(`${at}.name must be a non-empty string`);
  }
  if (name.includes(PATH_SEPARATOR)) {
    throw new GraphLoadError(`${at}.name "${name}" must not contain "${PATH_SEPARATOR}"`);
  }
  if (typeof kind !== 'string' || kind.trim() === '') {
    throw new GraphLoadError(`${at}.kind must be a non-empty string`);
  }
  if (publicExposed !== undefined && typeof publicExposed !== 'boolean') {
    throw new GraphLoadError(`${at}.publicExposed must be a boolean`);
  }
  if (vulnerabilities !== undefined && !Array.isArray(vulnerabilities)) {
    throw new GraphLoadError(`${at}.vulnerabilities must be an array`);
  }
  if (metadata !== undefined && !isObject(metadata)) {
    throw new GraphLoadError(`${at}.metadata must be an object`);
  }
  for (const [field, value] of Object.entries({ language, path })) {
    if (value !== undefined && typeof value !== 'string') {
      throw new GraphLoadError(`${at}.${field} must be a string`);
    }
  }
  (vulnerabilities ?? []).forEach((v: unknown, i: number) => {
    if (!isObject(v)) throw new GraphLoadError(`${at}.vulnerabilities[${i}] must be an object`);
  });

  return {
    // Unknown extra fields are preserved as given.
    ...raw,
    id: name,
    name,
    kind,
    publicExposed: publicExposed ?? false,
    vulnerabilities: (vulnerabilities ?? []) as Vulnerability[],
    isSink: SINK_KINDS.has(kind.toLowerCase()),
  };
}

/** Normalizes `to: string | string[]` into individual `[source, target]` pairs. */
function parseEdge(raw: unknown, index: number): [string, string][] {
  const at = `edges[${index}]`;
  if (!isObject(raw)) throw new GraphLoadError(`${at} must be an object`);
  const { from, to } = raw;
  if (typeof from !== 'string') throw new GraphLoadError(`${at}.from must be a string`);

  const targets = typeof to === 'string' ? [to] : to;
  if (!Array.isArray(targets) || targets.some((t) => typeof t !== 'string')) {
    throw new GraphLoadError(`${at}.to must be a string or an array of strings`);
  }
  return (targets as string[]).map((target) => [from, target]);
}

function checkEdge(
  source: string,
  target: string,
  nodeIds: ReadonlySet<string>,
  adjacency: ReadonlyMap<string, readonly string[]>,
): GraphWarning | undefined {
  const missing = [source, target].filter((id) => !nodeIds.has(id));
  if (missing.length > 0) {
    const which =
      missing.length === 2 ? 'Source and target nodes are' : source === missing[0] ? 'Source node is' : 'Target node is';
    return { code: 'DANGLING_EDGE', source, target, message: `${which} not defined` };
  }
  if (source === target) {
    return { code: 'SELF_LOOP', source, target, message: 'Self-loop can never be part of a simple path' };
  }
  if (adjacency.get(source)!.includes(target)) {
    return { code: 'DUPLICATE_EDGE', source, target, message: 'Duplicate connection; first occurrence kept' };
  }
  return undefined;
}
