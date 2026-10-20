import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY_STATE, parseQueryState, serializeQueryState } from '../src/lib/url-state';

const KNOWN = ['publicEntry', 'endsAtSink', 'hasVulnerability'];
const parse = (search: string) => parseQueryState(new URLSearchParams(search), KNOWN);

describe('parseQueryState', () => {
  it('an empty URL is the default state', () => {
    expect(parse('')).toEqual(DEFAULT_QUERY_STATE);
  });

  it('reads every parameter', () => {
    expect(parse('filters=endsAtSink,hasVulnerability&maxDepth=8&view=matching')).toEqual({
      filters: ['endsAtSink', 'hasVulnerability'],
      maxDepth: 8,
      view: 'matching',
    });
  });

  it('orders filters by registry, drops duplicates, unknown IDs and blanks', () => {
    expect(parse('filters=hasVulnerability,nope,,publicEntry,hasVulnerability').filters).toEqual([
      'publicEntry',
      'hasVulnerability',
    ]);
  });

  it.each(['0', '31', '-1', '1.5', 'abc', '', '12x'])('invalid maxDepth "%s" falls back to the default', (raw) => {
    expect(parse(`maxDepth=${raw}`).maxDepth).toBe(12);
  });

  it('ignores the old limit parameter (paging replaced it)', () => {
    expect(parse('limit=100')).toEqual(DEFAULT_QUERY_STATE);
  });

  it('accepts the range boundaries', () => {
    expect(parse('maxDepth=1').maxDepth).toBe(1);
    expect(parse('maxDepth=30').maxDepth).toBe(30);
  });

  it('invalid view falls back to full', () => {
    expect(parse('view=sideways').view).toBe('full');
  });
});

describe('serializeQueryState', () => {
  it('omits defaults', () => {
    expect(serializeQueryState(DEFAULT_QUERY_STATE, KNOWN)).toBe('');
  });

  it('writes filters in registry order, de-duplicated, with readable commas', () => {
    const state = { ...DEFAULT_QUERY_STATE, filters: ['hasVulnerability', 'endsAtSink', 'endsAtSink'] };
    expect(serializeQueryState(state, KNOWN)).toBe('filters=endsAtSink,hasVulnerability');
  });

  it('round-trips', () => {
    const search = 'filters=publicEntry,endsAtSink&maxDepth=5&view=matching';
    expect(serializeQueryState(parse(search), KNOWN)).toBe(search);
    const state = parse(search);
    expect(parse(serializeQueryState(state, KNOWN))).toEqual(state);
  });

  it('canonicalizes a messy URL to a stable form, dropping an old limit parameter', () => {
    expect(serializeQueryState(parse('view=full&maxDepth=12&filters=x,hasVulnerability&limit=100'), KNOWN)).toBe(
      'filters=hasVulnerability',
    );
  });
});
