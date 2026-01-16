import Fuse, { type IFuseOptions } from 'fuse.js';
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

// ==================== Fuse.js Setup ====================
export const createArabicFuseSearch = <T>(
  collection: T[],
  keys: string[],
  options: Partial<IFuseOptions<T>> = {},
): Fuse<T> =>
  new Fuse(collection, {
    includeScore: true,
    threshold: 0.3,
    distance: 50,
    ignoreLocation: true,
    minMatchCharLength: 2,
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

  return items.filter((item) => {
    const fieldValue = String(item[searchField] || '');
    return normalizeArabic(fieldValue).includes(cleanQuery);
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
  options: AdvancedSearchOptions,
  mapEntry?: { lemma?: string; root?: string },
): ScoredQuranText => {
  let score = 0;
  let matchType: MatchType = 'none';
  let matchedTokens: string[] = [];
  const tokenTypes: Record<string, MatchType> = {};

  // 1. Text (Exact) Matches - Weight: 3
  const textMatches = getPositiveTokens(
    verse,
    'text',
    undefined,
    undefined,
    cleanQuery,
    morphologyMap,
  );
  if (textMatches.length > 0) {
    score += textMatches.length * 3;
    matchType = 'exact';
    matchedTokens = [...matchedTokens, ...textMatches];
    textMatches.forEach((t) => (tokenTypes[t] = 'exact'));
  }

  // 2. Lemma Matches - Weight: 2
  if (options.lemma && mapEntry?.lemma) {
    const lemmaMatches = getPositiveTokens(
      verse,
      'lemma',
      mapEntry.lemma,
      undefined,
      cleanQuery,
      morphologyMap,
    );
    if (lemmaMatches.length > 0) {
      score += lemmaMatches.length * 2;
      if (matchType !== 'exact') matchType = 'lemma';
      matchedTokens = [...matchedTokens, ...lemmaMatches];
      lemmaMatches.forEach((t) => {
        if (!tokenTypes[t]) tokenTypes[t] = 'lemma';
      });
    }
  }

  // 3. Root Matches - Weight: 1
  if (options.root && mapEntry?.root) {
    const rootMatches = getPositiveTokens(
      verse,
      'root',
      undefined,
      mapEntry.root,
      cleanQuery,
      morphologyMap,
    );
    if (rootMatches.length > 0) {
      score += rootMatches.length;
      if (matchType !== 'exact' && matchType !== 'lemma') matchType = 'root';
      matchedTokens = [...matchedTokens, ...rootMatches];
      rootMatches.forEach((t) => {
        if (!tokenTypes[t]) tokenTypes[t] = 'root';
      });
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
): QuranText[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const entry = wordMap[cleanQuery];

  // If no dictionary entry, fallback to fuzzy search
  if (!entry) return fuseInstance.search(cleanQuery).map((res) => res.item);

  const { lemma: targetLemma, root: targetRoot } = entry;
  const matchingGids = new Set<number>();

  if (options.lemma && targetLemma) {
    for (const verse of quranData) {
      const morph = morphologyMap.get(verse.gid);
      if (morph?.lemmas.some((l) => normalizeArabic(l).includes(normalizeArabic(targetLemma)))) {
        matchingGids.add(verse.gid);
      }
    }
  }

  if (options.root && targetRoot) {
    for (const verse of quranData) {
      const morph = morphologyMap.get(verse.gid);
      if (morph?.roots.some((r) => normalizeArabic(r).includes(normalizeArabic(targetRoot)))) {
        matchingGids.add(verse.gid);
      }
    }
  }

  if (matchingGids.size > 0) {
    const gidToVerse = new Map(quranData.map((v) => [v.gid, v]));
    return Array.from(matchingGids)
      .map((gid) => gidToVerse.get(gid))
      .filter((v): v is QuranText => !!v);
  }

  return fuseInstance.search(cleanQuery).map((res) => res.item);
};

// ==================== Combined Search API ====================

/**
 * Performs a comprehensive search across the Quran.
 * Combines simple text search with linguistic (lemma/root) analysis and fuzzy fallback.
 * Results are scored, deduplicated, and sorted by relevance.
 */
export const advancedSearch = (
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
      combined.push(computeScore(verse, cleanQuery, morphologyMap, options, mapEntry));
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
