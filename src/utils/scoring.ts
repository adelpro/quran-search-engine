import type { FuseResultMatch } from 'fuse.js';
import { getPositiveTokens } from './tokenization';
import type {
  VerseInput,
  ScoredVerse,
  WordMap,
  MorphologyAya,
  AdvancedSearchOptions,
  MatchType,
} from '../types';

/**
 * Computes a weighted relevance score for a verse based on match types.
 * Exact Match = 3pts, Lemma Match = 2pts, Root Match = 1pt.
 * @param verse - The verse object to be scored.
 * @param cleanQuery - The normalized search query.
 * @param morphologyMap - Data map for morphological analysis.
 * @param wordMap - Data map for lemma/root lookups.
 * @param options - Advanced search settings (enable/disable lemma/root).
 * @param mapEntry - (Legacy) Deprecated mapping entry.
 * @param fuseMatches - Optional fuzzy match data from Fuse.js.
 * @returns The verse object enriched with score and match metadata.
 */
export const computeScore = <TVerse extends VerseInput>(
  verse: TVerse,
  cleanQuery: string,
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions,
  mapEntry?: { lemma?: string; root?: string }, // Deprecated/Legacy
  fuseMatches?: readonly FuseResultMatch[],
): ScoredVerse<TVerse> => {
  let score = 0;
  let matchType: MatchType = 'none';
  let matchedTokens: string[] = [];
  const tokenTypes: Record<string, MatchType> = {};

  const queryTokens = cleanQuery.split(/\s+/);

  // Check each token
  for (const token of queryTokens) {
    // 1. Text (Exact) Matches - Weight: 3
    const textMatches = getPositiveTokens(
      verse,
      'text',
      undefined,
      undefined,
      token,
      morphologyMap,
    );
    const uniqueTextMatches = new Set(textMatches);
    if (uniqueTextMatches.size > 0) {
      score += 3;
      if (matchType === 'none') matchType = 'exact';
      matchedTokens.push(...uniqueTextMatches);
      uniqueTextMatches.forEach((t: string) => (tokenTypes[t] = 'exact'));
    }

    // 2. Lemma/Root Matches
    const entry = wordMap[token];
    if (entry) {
      if (options.lemma && entry.lemma) {
        const lemmaMatches = getPositiveTokens(
          verse,
          'lemma',
          entry.lemma,
          undefined,
          token,
          morphologyMap,
        );
        const uniqueLemmaMatches = new Set(lemmaMatches);
        if (uniqueLemmaMatches.size > 0) {
          score += 2;
          if (matchType !== 'exact') matchType = 'lemma';
          matchedTokens.push(...uniqueLemmaMatches);
          uniqueLemmaMatches.forEach((t: string) => {
            if (!tokenTypes[t]) tokenTypes[t] = 'lemma';
          });
        }
      }

      if (options.root && entry.root) {
        const rootMatches = getPositiveTokens(
          verse,
          'root',
          undefined,
          entry.root,
          token,
          morphologyMap,
          wordMap,
        );
        const uniqueRootMatches = new Set(rootMatches);
        if (uniqueRootMatches.size > 0) {
          score += 1;
          if (matchType !== 'exact' && matchType !== 'lemma') matchType = 'root';
          matchedTokens.push(...uniqueRootMatches);
          uniqueRootMatches.forEach((t: string) => {
            if (!tokenTypes[t]) tokenTypes[t] = 'root';
          });
        }
      }
    }
  }

  // 4. Fuzzy Matches (Fallback) - Weight: 0.5 (or just purely for highlighting)
  if (matchType === 'none' && fuseMatches && fuseMatches.length > 0) {
    matchType = 'fuzzy';
    // Extract tokens from Fuse matches
    const fuzzyTokens: string[] = [];
    fuseMatches.forEach((match) => {
      const { key, indices } = match;
      if (!key || !indices) return;

      const sourceText = (verse as Record<string, unknown>)[key];
      if (typeof sourceText === 'string') {
        indices.forEach(([start, end]) => {
          // Fuse indices are inclusive [start, end]
          const token = sourceText.substring(start, end + 1);
          if (token) {
            fuzzyTokens.push(token);
            tokenTypes[token] = 'fuzzy';
          }
        });
      }
    });

    if (fuzzyTokens.length > 0) {
      matchedTokens = [...matchedTokens, ...fuzzyTokens];
      // Add some score for fuzzy matches
      score += fuzzyTokens.length * 0.5;
    }
  }

  // Deduplicate tokens
  matchedTokens = Array.from(new Set(matchedTokens));

  return { ...verse, matchScore: score, matchType, matchedTokens, tokenTypes };
};
