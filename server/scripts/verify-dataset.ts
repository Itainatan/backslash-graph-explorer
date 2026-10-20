/**
 * Independent re-computation of the dataset figures in the implementation spec (§4, §6, §8, §13).
 * Deliberately self-contained: it does not import the API code, so it cross-checks it.
 *
 * Run from server/: node scripts/verify-dataset.ts [path/to/graph.json]   (Node >= 22.6 strips types natively)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface RawNode {
  name: string;
  kind: string;
  publicExposed?: boolean;
  vulnerabilities?: { severity?: string; message?: string; metadata?: { cwe?: string } }[];
}
interface RawEdge {
  from: string;
  to: string | string[];
}

const file = resolve(process.argv[2] ?? 'data/train-ticket.json');
const raw = JSON.parse(readFileSync(file, 'utf8')) as { nodes: RawNode[]; edges: RawEdge[] };

const nodes = new Map(raw.nodes.map((n) => [n.name, n]));
const adj = new Map<string, string[]>(raw.nodes.map((n) => [n.name, []]));
const inDeg = new Map<string, number>(raw.nodes.map((n) => [n.name, 0]));
const dangling: string[] = [];
let rawEdgeCount = 0;
let duplicates = 0;
let selfLoops = 0;

for (const e of raw.edges) {
  for (const to of Array.isArray(e.to) ? e.to : [e.to]) {
    rawEdgeCount++;
    if (!nodes.has(e.from) || !nodes.has(to)) {
      dangling.push(`${e.from} -> ${to}`);
      continue;
    }
    if (e.from === to) {
      selfLoops++;
      continue;
    }
    const out = adj.get(e.from)!;
    if (out.includes(to)) {
      duplicates++;
      continue;
    }
    out.push(to);
    inDeg.set(to, inDeg.get(to)! + 1);
  }
}

const ids = [...nodes.keys()];
const isPublic = (id: string) => nodes.get(id)!.publicExposed === true;
const isSink = (id: string) => ['rds', 'sql'].includes(nodes.get(id)!.kind.toLowerCase());
const isVuln = (id: string) => (nodes.get(id)!.vulnerabilities ?? []).length > 0;
const isRoot = (id: string) => inDeg.get(id) === 0;
const isTerminal = (id: string) => adj.get(id)!.length === 0;
const isStart = (id: string) => isRoot(id) || isPublic(id);
const isEnd = (id: string) => isTerminal(id) || isSink(id);
const edgeCount = [...adj.values()].reduce((s, a) => s + a.length, 0);

/** §6/§8 semantics: start = roots ∪ public, end = terminals ∪ sinks, keep going past an end that has out-edges. */
function completePaths(maxDepth = Infinity) {
  const out: string[][] = [];
  let depthCutoff = false;
  const visit = (path: string[], onPath: Set<string>) => {
    const node = path[path.length - 1];
    if (isEnd(node)) out.push([...path]);
    const next = adj.get(node)!.filter((n) => !onPath.has(n));
    if (path.length >= maxDepth && next.length) {
      depthCutoff = true;
      return;
    }
    for (const n of next) {
      path.push(n);
      onPath.add(n);
      visit(path, onPath);
      onPath.delete(n);
      path.pop();
    }
  };
  for (const s of ids.filter(isStart)) visit([s], new Set([s]));
  return { paths: out, depthCutoff };
}

/** Every simple path with >= 1 node (the "all sub-paths" alternative the spec rejects). */
function allSimplePaths() {
  const out: string[][] = [];
  const visit = (path: string[]) => {
    out.push([...path]);
    for (const n of adj.get(path[path.length - 1])!) if (!path.includes(n)) visit([...path, n]);
  };
  for (const s of ids) visit([s]);
  return out;
}

function reachable(from: string) {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    for (const n of adj.get(stack.pop()!)!) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

function resultGraph(paths: string[][]) {
  const ns = new Set<string>();
  const es = new Set<string>();
  for (const p of paths) {
    p.forEach((n, i) => {
      ns.add(n);
      if (i > 0) es.add(`${p[i - 1]}->${n}`);
    });
  }
  return { nodes: ns.size, edges: es.size };
}

const { paths } = completePaths();
const lengthDist: Record<number, number> = {};
for (const p of paths) lengthDist[p.length] = (lengthDist[p.length] ?? 0) + 1;
const coveredNodes = new Set(paths.flat());
const all = allSimplePaths();
const multiNodeSimple = all.filter((p) => p.length > 1).length;
const publicReach = new Set(ids.filter(isPublic).flatMap((p) => [...reachable(p)]));

const kindCount: Record<string, number> = {};
for (const n of nodes.values()) kindCount[n.kind] = (kindCount[n.kind] ?? 0) + 1;

console.log('== §4 dataset facts ==');
console.table({
  nodes: nodes.size,
  ...Object.fromEntries(Object.entries(kindCount).map(([k, v]) => [`kind:${k}`, v])),
  rawEdges: rawEdgeCount,
  validEdges: edgeCount,
  dangling: dangling.length,
  duplicates,
  selfLoops,
  public: ids.filter(isPublic).length,
  vulnerableNodes: ids.filter(isVuln).length,
  vulnerabilityFindings: ids.reduce((s, id) => s + (nodes.get(id)!.vulnerabilities?.length ?? 0), 0),
  sinks: ids.filter(isSink).length,
  roots: ids.filter(isRoot).length,
  terminals: ids.filter(isTerminal).length,
  isolated: ids.filter((id) => isRoot(id) && isTerminal(id)).length,
  completePaths: paths.length,
  singleNodePaths: lengthDist[1] ?? 0,
  longestPath: Math.max(...paths.map((p) => p.length)),
  nodesOnNoPath: ids.filter((id) => !coveredNodes.has(id)).length,
  reachableFromFrontend: reachable('frontend').size,
  allSimplePathsInclSingle: all.length,
  allSimplePathsMultiNode: multiNodeSimple,
});
console.log('dangling:', dangling);
console.log('isolated:', ids.filter((id) => isRoot(id) && isTerminal(id)));
console.log('start set == roots?', ids.filter(isStart).length === ids.filter(isRoot).length);
console.log('end set == terminals?', ids.filter(isEnd).length === ids.filter(isTerminal).length);
console.log('length distribution:', lengthDist);
console.log('first path:', paths[0].join(' > '));
console.log(
  'public reach:',
  [...publicReach],
  '| vulnerable:',
  [...publicReach].filter(isVuln).length,
  '| reaches sink:',
  [...publicReach].some(isSink),
);

console.log('\n== §13 filter combinations ==');
const filters = {
  publicEntry: (p: string[]) => isPublic(p[0]),
  endsAtSink: (p: string[]) => isSink(p[p.length - 1]),
  hasVulnerability: (p: string[]) => p.some(isVuln),
};
const rows = [];
for (let mask = 0; mask < 8; mask++) {
  const active = Object.entries(filters).filter((_, i) => mask & (1 << i));
  const matched = paths.filter((p) => active.every(([, f]) => f(p)));
  rows.push({
    publicEntry: mask & 1 ? 'on' : 'off',
    endsAtSink: mask & 2 ? 'on' : 'off',
    hasVulnerability: mask & 4 ? 'on' : 'off',
    paths: matched.length,
    ...resultGraph(matched),
  });
}
console.table(rows);

console.log('public paths:', paths.filter(filters.publicEntry).map((p) => p.join(' > ')));
const sinkPaths = paths.filter(filters.endsAtSink);
console.log('all sink paths contain a vulnerable node?', sinkPaths.every(filters.hasVulnerability));
console.log('sink-ending fragments among all multi-node simple paths:', all.filter((p) => p.length > 1 && filters.endsAtSink(p)).length);

console.log('\n== §8 depth boundaries ==');
for (const d of [5, 6]) {
  const r = completePaths(d);
  const sixPrefixes = paths.filter((p) => p.length === 6).map((p) => p.slice(0, 5).join('>'));
  const leakedPrefix = r.paths.some((p) => sixPrefixes.includes(p.join('>')));
  console.log(`maxDepth ${d}: ${r.paths.length} paths, depthCutoff=${r.depthCutoff}, 5-node prefix leaked=${leakedPrefix}`);
}
