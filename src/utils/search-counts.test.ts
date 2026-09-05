import { describe, it, expect } from 'vitest';
import { buildSearchCounts } from './search-counts';
import type { MatchType } from '../types';

const verse = (matchType: MatchType) => ({ matchType });

describe('buildSearchCounts', () => {
  it('counts only genuine fuzzy matches in fuzzy (refs #102)', () => {
    const counts = buildSearchCounts([
      verse('exact'),
      verse('exact'),
      verse('fuzzy'),
      verse('none'),
      verse('none'),
    ]);

    expect(counts.simple).toBe(2);
    expect(counts.fuzzy).toBe(1);
    expect(counts.total).toBe(5);
  });

  it('reports unscored matches in total only', () => {
    const counts = buildSearchCounts([verse('none'), verse('lemma'), verse('root')]);

    expect(counts.lemma).toBe(1);
    expect(counts.root).toBe(1);
    expect(counts.fuzzy).toBe(0);
    expect(counts.total).toBe(3);
  });

  it('tallies every layer including regex and range', () => {
    const counts = buildSearchCounts([
      verse('exact'),
      verse('lemma'),
      verse('root'),
      verse('fuzzy'),
      verse('semantic'),
      verse('regex'),
      verse('range'),
    ]);

    expect(counts).toEqual({
      simple: 1,
      lemma: 1,
      root: 1,
      fuzzy: 1,
      semantic: 1,
      regex: 1,
      range: 1,
      total: 7,
    });
  });

  it('returns zeros for an empty result set', () => {
    expect(buildSearchCounts([])).toEqual({
      simple: 0,
      lemma: 0,
      root: 0,
      fuzzy: 0,
      semantic: 0,
      regex: 0,
      range: 0,
      total: 0,
    });
  });
});
