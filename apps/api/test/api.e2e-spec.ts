import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { GraphResponse, PathQueryResponse } from '@graph-explorer/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loadConfig } from '../src/config';

const ALLOWED_ORIGIN = 'https://explorer.example.app';

describe('HTTP API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const config = loadConfig({ CORS_ORIGINS: `${ALLOWED_ORIGIN},http://localhost:5173` });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ config })] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, config);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(() => app.close());

  const query = (body: unknown) => http.post('/api/paths/query').send(body as object);

  it('GET /api/health', async () => {
    await http.get('/api/health').expect(200, { status: 'ok' });
  });

  it('GET /api/graph returns the normalized graph with edge IDs', async () => {
    const { body } = await http.get('/api/graph').expect(200);
    const graph = body as GraphResponse;
    expect(graph.nodes).toHaveLength(46);
    expect(graph.edges).toHaveLength(96);
    expect(graph.edges.every((e) => e.id === `${e.source}->${e.target}`)).toBe(true);
    expect(JSON.stringify(graph.nodes)).not.toContain('assurance-service');
    expect(graph.edges.some((e) => e.target === 'assurance-service')).toBe(false);
    expect(graph.warnings).toHaveLength(2);
  });

  it('GET /api/graph/stats', async () => {
    const { body } = await http.get('/api/graph/stats').expect(200);
    expect(body).toMatchObject({ nodeCount: 46, edgeCount: 96, completePathCount: 220, completePathCountExact: true });
  });

  it('GET /api/filters lists the registry in order', async () => {
    const { body } = await http.get('/api/filters').expect(200);
    expect(body.map((f: { id: string }) => f.id)).toEqual(['publicEntry', 'endsAtSink', 'hasVulnerability']);
    expect(Object.keys(body[0]).sort()).toEqual(['description', 'id', 'label']);
  });

  describe('POST /api/paths/query', () => {
    it('{} returns all 220 complete paths with defaults echoed', async () => {
      const { body } = await query({}).expect(200);
      expect(body.paths).toHaveLength(220);
      expect(body.meta).toMatchObject({ filters: [], maxDepth: 12, limit: 250, truncated: false });
    });

    it('a request with no body is treated as {}', async () => {
      const { body } = await http.post('/api/paths/query').expect(200);
      expect(body.meta.matchedCount).toBe(220);
    });

    it('returns 200 with an empty list when nothing matches', async () => {
      const { body } = await query({ filters: ['publicEntry', 'endsAtSink', 'hasVulnerability'] }).expect(200);
      expect(body).toMatchObject({
        paths: [],
        graph: { nodes: [], edges: [] },
        meta: { matchedCount: 0, matchedCountExact: true, truncated: false },
      });
    });

    it('two identical requests return identical bodies', async () => {
      const a = await query({ filters: ['hasVulnerability'] });
      const b = await query({ filters: ['hasVulnerability'] });
      expect(a.body).toEqual(b.body);
    });

    it('response graph edges are exactly the traversed pairs', async () => {
      const { body } = (await query({ filters: ['endsAtSink'], limit: 5 })) as { body: PathQueryResponse };
      const traversed = new Set(body.paths.flatMap((p) => p.nodeIds.slice(1).map((id, i) => `${p.nodeIds[i]}->${id}`)));
      expect(new Set(body.graph.edges.map((e) => e.id))).toEqual(traversed);
    });

    it.each<[string, unknown, RegExp]>([
      ['array body', [], /request body must be a JSON object/],
      ['unknown property', { foo: 1 }, /property foo should not exist/],
      ['filters not an array', { filters: 'endsAtSink' }, /filters must be an array/],
      ['filters with non-strings', { filters: [1] }, /filters must be a string/],
      ['unknown filter ID', { filters: ['nope'] }, /filters must be one of: publicEntry, endsAtSink, hasVulnerability/],
      ['duplicate filter IDs', { filters: ['endsAtSink', 'endsAtSink'] }, /filters must not contain duplicates/],
      ['non-integer maxDepth', { maxDepth: 1.5 }, /^maxDepth must be an integer number$/],
      ['string maxDepth (no coercion)', { maxDepth: '12' }, /^maxDepth must be an integer number$/],
      ['maxDepth 0', { maxDepth: 0 }, /^maxDepth must not be less than 1$/],
      ['maxDepth above max', { maxDepth: 31 }, /^maxDepth must not be greater than 30$/],
      ['non-integer limit', { limit: 1.5 }, /^limit must be an integer number$/],
      ['string limit', { limit: '10' }, /^limit must be an integer number$/],
      ['negative limit', { limit: -1 }, /^limit must not be less than 1$/],
      ['limit above max', { limit: 501 }, /^limit must not be greater than 500$/],
      ['boolean as filter', { filters: [true] }, /filters must be a string/],
    ])('400 for %s', async (_name, body, message) => {
      const res = await query(body).expect(400);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(message)]));
    });

    it.each([
      ['malformed JSON', '{bad'],
      ['null body', 'null'],
      ['primitive body', '42'],
    ])('400 for %s', async (_name, raw) => {
      const res = await http.post('/api/paths/query').set('Content-Type', 'application/json').send(raw).expect(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toBeTruthy();
    });

    it('415 for a non-JSON content type', async () => {
      const res = await http.post('/api/paths/query').set('Content-Type', 'text/plain').send('{}').expect(415);
      expect(res.body).toMatchObject({ statusCode: 415, message: 'Content-Type must be application/json' });
    });
  });

  it('unknown /api route → 404 JSON', async () => {
    const res = await http.get('/api/x').expect(404).expect('Content-Type', /json/);
    expect(res.body.statusCode).toBe(404);
  });

  describe('CORS', () => {
    it('allows a configured origin, including the JSON POST preflight', async () => {
      await http.get('/api/health').set('Origin', ALLOWED_ORIGIN).expect('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      const preflight = await http
        .options('/api/paths/query')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type')
        .expect(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(preflight.headers['access-control-allow-headers']).toMatch(/content-type/i);
    });

    it('does not allow any other origin', async () => {
      const res = await http.get('/api/health').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
