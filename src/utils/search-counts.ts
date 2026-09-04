import type { MatchType, SearchCounts } from '../types';

/**
 * Tallies per-layer match counts over a fully scored result set.
 *
 * `fuzzy` counts only verses whose `matchType` is `'fuzzy'`. Verses that
 * reached the result set without any layer claiming them (`matchType: 'none'`)
 * are reported in `total` only, so the per-type fields intentionally do not
 * sum to `total` when unscored matches are present.
 *
 * Shared by `search()` and the multi-term merger so both report the same
 * grouping (see #102).
 *
 * @param scored - The complete, deduplicated result set before pagination.
 * @returns Per-type counts plus the overall total.
 */
export const buildSearchCounts = <T extends { matchType: MatchType }>(
  scored: readonly T[],
): SearchCounts => ({
  simple: scored.filter((v) => v.matchType === 'exact').length,
  lemma: scored.filter((v) => v.matchType === 'lemma').length,
  root: scored.filter((v) => v.matchType === 'root').length,
  fuzzy: scored.filter((v) => v.matchType === 'fuzzy').length,
  semantic: scored.filter((v) => v.matchType === 'semantic').length,
  regex: scored.filter((v) => v.matchType === 'regex').length,
  range: scored.filter((v) => v.matchType === 'range').length,
  total: scored.length,
});
