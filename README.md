# Backslash Graph Explorer

## TL;DR

A graph query engine, REST API and investigation UI for the Train Ticket microservice graph.

- **Backend**: NestJS loads `data/train-ticket.json` once, validates it, and enumerates every route from an entry point to an end point with a depth-first search. Routes can be filtered by a registry of pluggable filters (public entry, ends at a sink, has a vulnerability).
- **Frontend**: React + React Flow dashboard. Toggle filters, see the matching routes on the graph, and inspect any service.
- **Live**: UI `<VERCEL_URL>` · API `<RENDER_URL>/api/health` (free tier: the first request may take up to a minute)
- **Run locally** (Node 24, see `.nvmrc`), in two terminals: `cd server && npm ci && npm run dev` and `cd client && npm ci && npm run dev`, then open http://localhost:5173
- **Test**: `npm test` in each folder (128 tests: 102 server, 26 client)

**Key finding**: the full attack-path query (public entry → vulnerable service → database) returns **0 routes**. That is a property of the data, not a bug: `frontend` reaches only 6 other services, none vulnerable and none a database, and the public `gateway-service` has no edges at all ([Data quality](#data-quality)).

## Requirements checklist

| Requirement | Where |
| --- | --- |
| Load the JSON and build a query engine | `graph.loader.ts`, `graph.service.ts`, `path-search.ts` |
| API returns a graph a client can render | `GET /api/graph`; every query response includes `graph: { nodes, edges }` |
| Routes starting at a public service | `publicEntry` filter |
| Routes ending at a sink (rds/sql) | `endsAtSink` filter |
| Routes with a vulnerable node | `hasVulnerability` filter |
| Filtering as generic as possible | Filter registry + `GET /api/filters`; a new filter is one file plus one line ([how](#filtering-architecture)) |
| README with decisions and assumptions | This file |
| TypeScript | Everywhere, `strict: true` |
| Usable frontend (interviewer request) | `client/` |

## Architecture

```text
React UI (Vite, React Flow, TanStack Query, URL state)
   │  HTTP/JSON
   ▼
NestJS API ── PathsController ── PathQueryService ── searchPaths (DFS)
   │                                   │
   │                                   └── filter registry (PathFilter[])
   └── GraphService (in-memory adjacency list, built once by loadGraph)
                    ▲
          data/train-ticket.json
```

```text
server/             NestJS API (own package.json; deployed to Render)
  src/api-types.ts    the REST contract (types only)
  src/graph/          loadGraph (pure: parse, validate, normalize), GraphService, /api/graph
  src/paths/          searchPaths (DFS engine), PathQueryService, filters/, DTO, /api/paths/query, /api/filters
  src/stats/          global statistics, /api/graph/stats
  data/               train-ticket.json, unchanged from the supplied file
  scripts/            verify-dataset.ts: independently recomputes every dataset figure
client/             React UI (own package.json; deployed to Vercel)
```

`searchPaths` knows nothing about filters: it receives one `(path) => boolean` predicate. `PathQueryService` builds that predicate from the registry.

**Shared API types.** `server` and `client` are independent projects with their own dependencies. The server owns the REST contract in `server/src/api-types.ts`. The client imports it type-only through a `@api-types` path alias (`client/tsconfig.json`). Type imports are erased at compile time, so no server code reaches the client bundle, but a changed response shape still breaks the client's typecheck.

## Path semantics

The PDF says "routes" without defining them. These are the definitions used:

- **Start nodes** = roots (no incoming edges) ∪ public services. A public service that is also called internally is still an internet entry point.
- **End nodes** = terminals (no outgoing edges) ∪ sinks. A database that calls something else is still a place a route can end.
- A **route** (complete path) is a simple directed path (no repeated node) from a start node to an end node. Length = number of nodes.
- A node that is both a start and an end (an isolated node) is a route of length 1.

On this dataset that gives **220 routes** (lengths 1–6).

**Why not every simple path?** There are 484 simple paths if every sub-path counts, and most are fragments of the same route. For example, 41 multi-node fragments end at the database, against 30 real routes. Root-to-terminal routes are the meaningful unit for an investigation. The trade-off: a short chain like `user-service → auth-service → prod-postgresdb` only appears inside longer routes.

**Cycles.** The dataset is acyclic, but the engine is safe on cyclic input: a node already on the current path is never revisited. A node with nothing left to visit that is not an end node is a *cycle dead end*: it is not emitted, but counted in `meta.cycleDeadEnds`. Known limitation: a cycle that no root or public node can reach is never explored. `/api/graph/stats` reports such nodes as `nodesOnNoPath` (0 here).

## Filtering architecture

A filter is a pure, synchronous predicate over a resolved path:

```ts
export interface PathFilter {
  id: string;          // stable, URL-safe: 'publicEntry'
  label: string;
  description: string;
  evaluate(path: readonly GraphNode[]): boolean;
}
```

- Active filters combine with **AND**; no filters means every route.
- Requests send `filters: string[]`. The DTO validates the IDs against the registry, so an unknown ID gets a 400 listing the valid ones.
- `GET /api/filters` returns `{ id, label, description }` in registry order, and the UI renders its toggles from it.

**Adding a fourth filter** takes one new file and one line in the registry. No DTO, URL or UI changes:

```ts
// server/src/paths/filters/high-severity.filter.ts
export const highSeverityFilter: PathFilter = {
  id: 'highSeverity',
  label: 'High severity',
  description: 'A service on the path has a high-severity finding',
  evaluate: (path) => path.some((n) => n.vulnerabilities.some((v) => v.severity === 'high')),
};

// filter.registry.ts
export const PATH_FILTERS = [publicEntryFilter, endsAtSinkFilter, hasVulnerabilityFilter, highSeverityFilter];
```

**Parameterized filters** (e.g. "passes through service X") would extend the contract to `{ id, params }`, each validated by the filter's own schema. Not built, because none of the required filters needs it.

## Algorithm and performance

- **DFS with backtracking** from each start node, in source order. The goal is to enumerate *all* routes, not the shortest, so DFS fits: it holds one path at a time (memory O(depth)) and gives a deterministic order. BFS would keep many partial paths in memory for no benefit.
- **Adjacency lists** (`Map<id, id[]>`) give O(out-degree) neighbour lookup.
- **Complexity**: O(P × L) for P routes of average length L. P can grow exponentially with density, so every request is bounded:

| Bound | Default | Allowed |
| --- | --: | --- |
| `maxDepth` (nodes per path) | 12 | 1–30 |
| `limit` (paths returned) | 250 | 1–500 |
| traversal budget (node expansions) | 50,000 | internal |

- **Honest truncation**: after `limit` paths are stored, matches are still counted, so the UI can say "showing 250 of 1,234". `meta.truncationReasons` lists any of `limit`, `depth` and `budget`. `matchedCountExact` is false if depth or budget cut the search, and the UI then says "at least N". A path cut at `maxDepth` is never returned as if it were complete.
- The response `graph` contains only the nodes and the exact edges traversed by the returned paths.
- At 46 nodes a query takes well under a millisecond. A graph database or a precomputed reachability index would be worth it only with millions of edges, frequent updates or multi-tenant data.

## Decisions

- **NestJS**: modules and DI keep the loader, engine and controllers separately testable, and it is the company stack.
- **In-memory data**: the graph is a static 46-node snapshot, loaded and validated once at startup. Corrupt input stops the app from booting with a clear error.
- **POST for queries**: the body is structured and will grow (parameterized filters), and nothing is mutated. A GET with query params would also be valid and HTTP-cacheable.
- **URL as the source of truth in the UI**: filters, limits and view live in the query string, so refresh, sharing a link and Back/Forward all work. The selection and hover are local state.

## Data quality

The JSON is used exactly as supplied. Issues are reported, never patched:

| Finding | Handling |
| --- | --- |
| `preserve-service → assurance-service` and `preserve-other-service → assurance-service`: `assurance-service` is not defined | Both edges skipped and returned as `DANGLING_EDGE` warnings. The UI shows "2 connections excluded" |
| `gateway-service` is public but has no edges (the PDF diagram routes all traffic through it) | Shown as an isolated node. It is a single-node route, the main reason the public filter finds so little |
| `frontend` reaches only `admin-basic-info-service` and 5 leaf services | Explains why every public → vulnerable/sink query returns 0. The UI says so in the empty state |
| Both SQL-concatenation findings carry `CWE-22` (Path Traversal); SQL injection is CWE-89 | Shown as given, with a "CWE may not match description" note |
| A message ends with `\n` | Trimmed for display only |
| The PDF diagram shows MySQL and RabbitMQ; the JSON has PostgreSQL (RDS) and SQS | The JSON is the source of truth |
| `prod-sqs` (kind `sqs`) | Not a sink: the sink filter is `rds`/`sql`, case-insensitive |

`npm run verify:data` (in `server/`) recomputes all of these figures independently of the app.

## API reference

All endpoints are under `/api` and return JSON. Types are in `server/src/api-types.ts`.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `{ "status": "ok" }` |
| GET | `/api/graph` | `{ nodes, edges, warnings }`, the full normalized graph |
| GET | `/api/graph/stats` | Global counts (never affected by filters) |
| GET | `/api/filters` | `[{ id, label, description }]` |
| POST | `/api/paths/query` | `{ paths, graph, meta }` |

```bash
curl -s localhost:3000/api/paths/query -H 'Content-Type: application/json' \
  -d '{"filters":["endsAtSink","hasVulnerability"],"limit":1}'
```

```json
{
  "paths": [{
    "id": "admin-user-service>user-service>auth-service>prod-postgresdb",
    "nodeIds": ["admin-user-service", "user-service", "auth-service", "prod-postgresdb"],
    "length": 4, "vulnerabilityCount": 1, "vulnerableNodeIds": ["auth-service"],
    "startsPublic": false, "endsAtSink": true
  }],
  "graph": { "nodes": ["…"], "edges": [{ "id": "admin-user-service->user-service", "source": "admin-user-service", "target": "user-service" }, "…"] },
  "meta": {
    "returnedCount": 1, "matchedCount": 30, "matchedCountExact": true,
    "truncated": true, "truncationReasons": ["limit"], "cycleDeadEnds": 0,
    "filters": ["endsAtSink", "hasVulnerability"], "maxDepth": 12, "limit": 1
  }
}
```

Every request field is optional; `{}` returns all routes. Errors:

- **400**, with a `message` array: malformed JSON, a body that is not an object, unknown properties, unknown or duplicate filter IDs, and `maxDepth`/`limit` that are not integers in range. Strings are never coerced: `"12"` is rejected.
- **415**: a non-JSON `Content-Type`.
- **404**: unknown `/api/*` routes.
- A query with no matches is **200** with `paths: []`.

## Running locally, tests, deployment

```bash
nvm use                 # Node 24 (engines: >=22.6)

# terminal 1
cd server
npm ci
npm run dev             # API on :3000, watch mode

# terminal 2
cd client
npm ci
npm run dev             # UI on :5173; Vite proxies /api to :3000, so no CORS
```

In each folder: `npm test` (Jest unit + e2e in `server`, Vitest in `client`), `npm run lint`, `npm run typecheck`, `npm run build`. In `server`: `npm run verify:data` to recompute the dataset figures.

API environment variables: `PORT` (default 3000), `DATA_FILE` (default `data/train-ticket.json`, relative to `server/`) and `CORS_ORIGINS` (comma-separated exact origins; empty means none).

**Deployment**: two services from the same repository.

- **API on Render**: `render.yaml` at the repository root (Blueprint) with root directory `server`. Build `npm ci --include=dev && npm run build`, start `node dist/main.js`, health check `/api/health`. Set `CORS_ORIGINS=https://<project>.vercel.app`.
- **UI on Vercel**: set the project's root directory to `client`. `client/vercel.json` sets install `npm ci`, build `npm run build`, output `dist`, and an SPA rewrite so deep links survive a refresh. Keep "Include files outside the root directory" enabled (the default), because the client typechecks against `server/src/api-types.ts`. Set `VITE_API_URL=https://<service>.onrender.com`, with no trailing slash. It is baked in at build time, so redeploy after changing it.
- Vercel preview deployments have their own URLs and are not in the CORS allowlist. To allow them, add each preview origin to `CORS_ORIGINS`.
- Render's free tier sleeps after ~15 minutes idle. The UI pings `/api/health` on load and shows a "waking up the server" message after 3 seconds.

## Known limitations and next steps

- The selected path is not in the URL, so a shared link restores the filters but not the selection.
- No pagination beyond `limit` (max 500).
- Cycles unreachable from any root or public node are not explored (reported as `nodesOnNoPath`).
- The graph layout is computed in the browser on each load and is not saved.
- No auth or persistence; the dataset is a static file.
- With more time: parameterized filters, the selected path in the URL, server-side pagination, and precomputed reachability for large graphs.

## AI assistance

AI tools (Claude Code) were used for planning and implementation. I reviewed the code and can explain every part of it.
