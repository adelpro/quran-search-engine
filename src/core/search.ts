import Fuse, { type IFuseOptions, type FuseResultMatch } from 'fuse.js';
import { normalizeArabic } from '../utils/normalization';
import { getPositiveTokens } from './tokenization';
import type {
  QuranText,
  WordMap,
  MorphologyAya,
  AdvancedSearchOptions,
  ScoredQuranText,
  MatchType,
  SearchResponse,
  SearchCounts,
  PaginationOptions,
} from '../types';

type QuranWithFuseMatches = QuranText & {
  fuseMatches?: readonly FuseResultMatch[];
};

// ==================== Fuse.js Setup ====================
export const createArabicFuseSearch = <T>(
  collection: T[],
  keys: string[],
  options: Partial<IFuseOptions<T>> = {},
): Fuse<T> =>
  new Fuse(collection, {
    includeScore: true,
    includeMatches: true,
    threshold: 0.5,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 3,
    useExtendedSearch: true,
    keys,
    ...options,
  });

// ==================== Utilities ====================

// ==================== Simple Search ====================
export const simpleSearch = <T extends Record<string, unknown>>(
  items: T[],
  query: string,
  searchField: keyof T,
): T[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const queryTokens = cleanQuery.split(/\s+/);

  return items.filter((item) => {
    const fieldValue = normalizeArabic(String(item[searchField] || ''));
    // AND logic: All tokens must be present
    return queryTokens.every((token) => fieldValue.includes(token));
  });
};

// ==================== Advanced Linguistic Search ====================

/**
 * Computes a weighted relevance score for a verse based on match types.
 * Exact Match = 3pts, Lemma Match = 2pts, Root Match = 1pt.
 */
export const computeScore = (
  verse: QuranText,
  cleanQuery: string,
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions,
  mapEntry?: { lemma?: string; root?: string }, // Deprecated/Legacy
  fuseMatches?: readonly FuseResultMatch[],
): ScoredQuranText => {
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
    if (textMatches.length > 0) {
      score += textMatches.length * 3;
      if (matchType === 'none') matchType = 'exact'; // Upgrade only if none
      matchedTokens.push(...textMatches);
      textMatches.forEach((t) => (tokenTypes[t] = 'exact'));
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
        if (lemmaMatches.length > 0) {
          score += lemmaMatches.length * 2;
          if (matchType !== 'exact') matchType = 'lemma';
          matchedTokens.push(...lemmaMatches);
          lemmaMatches.forEach((t) => {
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
        if (rootMatches.length > 0) {
          score += rootMatches.length * 1;
          if (matchType !== 'exact' && matchType !== 'lemma') matchType = 'root';
          matchedTokens.push(...rootMatches);
          rootMatches.forEach((t) => {
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

      const sourceText = verse[key as keyof QuranText];
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

export const performAdvancedLinguisticSearch = (
  query: string,
  quranData: QuranText[],
  options: AdvancedSearchOptions,
  fuseInstance: Fuse<QuranText>,
  wordMap: WordMap,
  morphologyMap: Map<number, MorphologyAya>,
): (QuranText & { fuseMatches?: readonly FuseResultMatch[] })[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/);

  // 1. Identify which verses match EACH token
  const tokenMatches = tokens.map((token) => {
    const entry = wordMap[token];
    const matchingGids = new Set<number>();

    // Linguistic search if dictionary entry exists
    if (entry) {
      const { lemma: targetLemma, root: targetRoot } = entry;

      if (options.lemma && targetLemma) {
        for (const verse of quranData) {
          const morph = morphologyMap.get(verse.gid);
          if (
            morph?.lemmas.some((lemma) =>
              normalizeArabic(lemma).includes(normalizeArabic(targetLemma)),
            )
          ) {
            matchingGids.add(verse.gid);
          }
        }
      }

      if (options.root && targetRoot) {
        for (const verse of quranData) {
          const morph = morphologyMap.get(verse.gid);
          if (
            morph?.roots.some((root) => normalizeArabic(root).includes(normalizeArabic(targetRoot)))
          ) {
            matchingGids.add(verse.gid);
          }
        }
      }

      if (matchingGids.size > 0) {
        return { type: 'linguistic', gids: matchingGids };
      }
    }

    // Fallback to Fuzzy/Fuse for this token if no linguistic match
    const fuseResults = fuseInstance.search(token);

    // Adaptive threshold for this token
    const hasHighQualityMatches = fuseResults.some(
      (res) => res.score !== undefined && res.score <= 0.25,
    );
    const cutoff = hasHighQualityMatches ? 0.35 : 0.5;

    const fuzzyGids = new Set<number>();
    const fuseMatchesMap = new Map<number, readonly FuseResultMatch[]>();

    fuseResults
      .filter((res) => res.score !== undefined && res.score <= cutoff)
      .forEach((res) => {
        fuzzyGids.add(res.item.gid);
        if (res.matches) fuseMatchesMap.set(res.item.gid, res.matches);
      });

    return { type: 'fuzzy', gids: fuzzyGids, fuseMatches: fuseMatchesMap };
  });

  // 2. Intersect results (AND logic)
  if (tokenMatches.length === 0) return [];

  // Start with the first set
  let intersection = new Set(tokenMatches[0].gids);

  for (let i = 1; i < tokenMatches.length; i++) {
    const currentGids = tokenMatches[i].gids;
    if (currentGids.size === 0) return []; // Short-circuit
    intersection = new Set([...intersection].filter((gid) => currentGids.has(gid)));
    if (intersection.size === 0) return [];
  }

  if (intersection.size === 0) return [];

  // 3. Map back to QuranText objects
  const gidToVerse = new Map(quranData.map((verse) => [verse.gid, verse]));

  const results: QuranWithFuseMatches[] = Array.from(intersection)
    .map((gid): QuranWithFuseMatches | null => {
      const verse = gidToVerse.get(gid);
      if (!verse) return null;

      const allFuseMatches: FuseResultMatch[] = [];

      tokenMatches.forEach((tokenMatch) => {
        if (tokenMatch.type === 'fuzzy' && tokenMatch.fuseMatches) {
          const matches = tokenMatch.fuseMatches.get(gid);
          if (matches) allFuseMatches.push(...matches);
        }
      });

      return {
        ...verse,
        fuseMatches: allFuseMatches.length > 0 ? [...allFuseMatches] : undefined,
      };
    })
    .filter((verse): verse is QuranWithFuseMatches => verse !== null);

  return results;
};

// ==================== Combined Search API ====================

/**
 * Performs a comprehensive search across the Quran.
 * Combines simple text search with linguistic (lemma/root) analysis and fuzzy fallback.
 * Results are scored, deduplicated, and sorted by relevance.
 */
export const search = (
  query: string,
  quranData: QuranText[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
): SearchResponse => {
  // 1. Prepare query
  const arabicOnly = query.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const cleanQuery = normalizeArabic(arabicOnly);

  if (!cleanQuery) {
    return {
      results: [],
      counts: { simple: 0, lemma: 0, root: 0, fuzzy: 0, total: 0 },
      pagination: {
        totalResults: 0,
        totalPages: 0,
        currentPage: pagination.page || 1,
        limit: pagination.limit || 20,
      },
    };
  }

  // 2. Initialize Fuse for fallback/fuzzy
  const fuseInstance = createArabicFuseSearch(quranData, ['simple', 'standard']);

  // 3. Run search layers
  const simpleMatches = simpleSearch(quranData, cleanQuery, 'standard');

  const advancedMatches = performAdvancedLinguisticSearch(
    cleanQuery,
    quranData,
    options,
    fuseInstance,
    wordMap,
    morphologyMap,
  );

  // 4. Combine and Scored Deduplication
  const allMatches = [...simpleMatches, ...advancedMatches];
  const gidSet = new Set<number>();
  const combined: ScoredQuranText[] = [];
  const mapEntry = wordMap[cleanQuery];

  for (const verse of allMatches) {
    if (!gidSet.has(verse.gid)) {
      gidSet.add(verse.gid);
      // Pass fuseMatches if available
      const fuseMatches =
        'fuseMatches' in verse ? (verse as QuranWithFuseMatches).fuseMatches : undefined;
      combined.push(
        computeScore(verse, cleanQuery, morphologyMap, wordMap, options, mapEntry, fuseMatches),
      );
    }
  }

  // 5. Sort by relevance
  combined.sort((a, b) => b.matchScore - a.matchScore);

  // 6. Pagination & Metadata
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.max(1, pagination.limit || 20);
  const offset = (page - 1) * limit;

  const results = combined.slice(offset, offset + limit);
  const totalResults = combined.length;
  const totalPages = Math.ceil(totalResults / limit);

  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: combined.filter((v) => v.matchType === 'lemma').length,
    root: combined.filter((v) => v.matchType === 'root').length,
    fuzzy: combined.filter((v) => v.matchType === 'none' || v.matchType === 'fuzzy').length,
    total: combined.length,
  };

  return {
    results,
    counts,
    pagination: {
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    },
  };
};
