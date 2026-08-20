import Fuse from 'fuse.js';
import { LRUCache } from '../utils/lru-cache';
import { normalizeArabic, isArabic } from '../utils/normalization';
import { parseRangeQuery, filterVersesByRange } from '../utils/range-parser';
import { getPhoneticFuse } from '../utils/phonetic';
import { InvalidPaginationError, MissingDependenciesError, InvalidQueryError } from '../errors';

import { validateRegex, performRegexSearch } from './layers/regex-search';
import { filterVerses, simpleSearch, simpleSearchOr } from './layers/simple-search';
import { createArabicFuseSearch } from './layers/fuse-search';
import { performAdvancedLinguisticSearch } from './layers/linguistic-search';
import { performSemanticSearch } from './layers/semantic-search';
import { computeScore } from '../utils/scoring';

import type {
  AdvancedSearchOptions,
  SearchResponse,
  SearchCounts,
  PaginationOptions,
  VerseInput,
  ScoredVerse,
  VerseWithFuseMatches,
  BooleanQuery,
  SearchContext,
} from '../types';
import {
  clearBooleanOperators,
  hasBooleanOperators,
  parseBooleanQuery,
  performBooleanSearch,
} from './layers/boolean-search';

/**
 * Performs a comprehensive search across the Quran.
 * Combines simple text search with linguistic (lemma/root) analysis and fuzzy fallback.
 * Results are scored, deduplicated, and sorted by relevance.
 * @param query - The user's input string.
 * @param quranData - The verse dataset.
 * @param morphologyMap - Morphological data for scoring.
 * @param wordMap - Dictionary for linguistic resolution.
 * @param options - Toggles for different search modes.
 * @param pagination - Page number and results per page.
 * @param preComputedFuseIndex - Optional pre-built fuzzy index.
 * @param cache - Optional LRU cache for performance.
 * @param invertedIndex - Optional Pre-built word/lemma/root indexes.
 * @returns Paginated results with metadata and match counts.
 * @example
 * result = search("الحمد لله", quranData, morphologyMap, wordMap, options, { page: 1, limit: 10 }, undefined, searchCache)
 */
export const search = <TVerse extends VerseInput>(
  query: string,
  context: SearchContext<TVerse>,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
): SearchResponse<TVerse> => {
  const { quranData, morphologyMap, wordMap, invertedIndex, semanticMap, phoneticMap } = context;

  // Validate required dependencies
  if (!quranData || !(quranData instanceof Map) || quranData.size === 0) {
    throw new MissingDependenciesError(['quranData']);
  }
  if (!morphologyMap) {
    throw new MissingDependenciesError(['morphologyMap']);
  }
  if (!wordMap) {
    throw new MissingDependenciesError(['wordMap']);
  }

  // Validate pagination parameters
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;

  if (page < 1 || !Number.isInteger(page)) {
    throw new InvalidPaginationError(page, limit);
  }
  if (limit < 1 || !Number.isInteger(limit)) {
    throw new InvalidPaginationError(page, limit);
  }

  // Validate query is not empty after normalization
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new InvalidQueryError(query, 'Query cannot be empty');
  }

  // 1. Range query shortcut
  const parsedRange = parseRangeQuery(query);
  if (parsedRange) {
    const quranDataArray = Array.from(quranData.values());
    const rangeMatches = filterVersesByRange(quranDataArray, parsedRange);
    const totalResults = rangeMatches.length;
    const totalPages = Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;

    const results: ScoredVerse<TVerse>[] = rangeMatches
      .slice(offset, offset + limit)
      .map((verse) => ({
        ...verse,
        matchScore: 1,
        matchType: 'range' as const,
        matchedTokens: [],
      }));

    return {
      results,
      counts: {
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: 0,
        range: totalResults,
        total: totalResults,
      },
      pagination: { totalResults, totalPages, currentPage: page, limit },
    };
  }

  // 2. Regex query shortcut
  if (options.isRegex) {
    const compiledRegex = validateRegex(query); // throws InvalidRegexError on bad input
    const filtered = filterVerses(quranData, options.suraId, options.juzId, options.suraName);
    const regexMatches = performRegexSearch(compiledRegex, filtered);
    const totalResults = regexMatches.length;
    const totalPages = Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;

    return {
      results: regexMatches.slice(offset, offset + limit),
      counts: {
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: totalResults,
        range: 0,
        total: totalResults,
      },
      pagination: { totalResults, totalPages, currentPage: page, limit },
    };
  }

  // Cache lookup
  const cacheKey = cache ? JSON.stringify({ query, options, pagination }) : '';
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const fuzzyEnabled = options.fuzzy !== false;

  // 3. Boolean operator detection and parsing
  // If the query contains boolean operators (+, -, |), parse them into structured form
  // and clean the query for normal search processing
  const booleanQuery: BooleanQuery | null = hasBooleanOperators(query)
    ? parseBooleanQuery(query)
    : null;

  // Remove boolean operators from query to extract clean search terms
  // Example: "+الله | الرحمن -الجحيم" → "الله الرحمن الجحيم"
  const operatorFreeQuery = clearBooleanOperators(query);

  // 4. Setup phase: Tokenize and handle phonetic translation
  const tokens = operatorFreeQuery.split(/\s+/);
  const processedTokens = tokens.map((token) => {
    // If it's a non-Arabic word, look it up via phonetic or translation maps
    if (token && !isArabic(token)) {
      const cleanToken = token.toLowerCase().trim();

      // TODO: Add Transliteration or direct English-to-Arabic Translation (e.g. "Peace" -> "سلام") here.
      // This is the correct place to intercept non-Arabic tokens before they fall back to purely phonetic matching.
      // Example implementation concept:
      // let translation = translationMap.get(cleanToken);
      // if (translation) return translation;

      let arabicPossibilities = phoneticMap?.get(cleanToken);

      // Fallback: Fuzzy phonetic match if exact match fails
      if (!arabicPossibilities && fuzzyEnabled) {
        const phoneticFuse = getPhoneticFuse();
        const fuzzyPhoneticMatches = phoneticFuse.search(cleanToken);
        if (fuzzyPhoneticMatches.length > 0 && (fuzzyPhoneticMatches[0].score ?? 1) < 0.3) {
          arabicPossibilities = phoneticMap?.get(fuzzyPhoneticMatches[0].item);
        }
      }

      // For now, we take the first match.
      return arabicPossibilities ? arabicPossibilities[0] : '';
    }
    return token;
  });

  const translatedQuery = processedTokens.filter(Boolean).join(' ');
  const arabicOnly = translatedQuery.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const cleanQuery = normalizeArabic(arabicOnly);

  const hasEnglishWords = operatorFreeQuery
    .split(/\s+/)
    .some((token) => !isArabic(token) && token.trim().length > 0);

  if (!cleanQuery && !(options.semantic && hasEnglishWords)) {
    return {
      results: [],
      counts: { simple: 0, lemma: 0, root: 0, fuzzy: 0, range: 0, total: 0, semantic: 0, regex: 0 },
      pagination: {
        totalResults: 0,
        totalPages: 0,
        currentPage: page,
        limit,
      },
    };
  }

  const fuseInstance = fuzzyEnabled
    ? fuseIndex || createArabicFuseSearch(Array.from(quranData.values()), ['standard', 'uthmani'])
    : null;

  // 5. Executing Search Layers
  // Use OR logic for boolean queries to get union of all terms, then filter with boolean logic
  // Use AND logic for normal queries to get intersection (phrase matching)
  const simpleMatches = booleanQuery
    ? simpleSearchOr(quranData, cleanQuery, 'standard', invertedIndex?.wordIndex)
    : simpleSearch(quranData, cleanQuery, 'standard', invertedIndex?.wordIndex);

  const advancedMatches = performAdvancedLinguisticSearch(
    cleanQuery,
    quranData,
    options,
    fuseInstance,
    wordMap,
    morphologyMap,
    invertedIndex?.lemmaIndex,
    invertedIndex?.rootIndex,
  );

  const semanticMatches = performSemanticSearch(
    cleanQuery,
    quranData,
    options,
    semanticMap,
    operatorFreeQuery,
    invertedIndex,
  );

  // 6. Boolean filtering (if boolean operators were present in query)
  // First, combine all search results from different layers
  const allMatches = [...simpleMatches, ...advancedMatches, ...semanticMatches];

  // Then, if boolean query exists, filter combined results based on boolean logic
  // This allows queries like "+الله -الرحمن الرحيم | العليم" to:
  // 1. Search for all terms (الله, الرحمن, الرحيم, العليم) using all search layers
  // 2. Filter results to keep only verses matching the boolean conditions
  const booleanMatches = booleanQuery ? performBooleanSearch(booleanQuery, allMatches) : allMatches;

  // 7. Scored deduplication and ranking
  const gidSet = new Set<number>();
  const combined: ScoredVerse<TVerse>[] = [];
  const mapEntry = wordMap.get(cleanQuery);

  for (const verse of booleanMatches) {
    if (!gidSet.has(verse.gid)) {
      gidSet.add(verse.gid);

      // If it's a semantic match (already scored), preserve it
      if ('matchType' in verse && verse['matchType'] === 'semantic') {
        combined.push(verse as ScoredVerse<TVerse>);
        continue;
      }

      // Pass fuseMatches if available
      const fuseMatches =
        'fuseMatches' in verse ? (verse as VerseWithFuseMatches<TVerse>).fuseMatches : undefined;
      combined.push(
        computeScore(verse, cleanQuery, morphologyMap, wordMap, options, mapEntry, fuseMatches),
      );
    }
  }

  // Sort by relevance
  combined.sort((a, b) => b.matchScore - a.matchScore);

  // 8. Pagination & Metadata
  const offset = (page - 1) * limit;

  const results = combined.slice(offset, offset + limit);
  const totalResults = combined.length;
  const totalPages = Math.ceil(totalResults / limit);

  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: combined.filter((v) => v.matchType === 'lemma').length,
    root: combined.filter((v) => v.matchType === 'root').length,
    // BUG: `fuzzy` also counts verses whose matchType is 'none', so it over-reports fuzzy
    // matches and no field reports unscored ones. Consumers displaying a per-type breakdown
    // (the CLI does) therefore attribute 'none' results to fuzzy matching. Tracked in #102.
    fuzzy: combined.filter((v) => v.matchType === 'none' || v.matchType === 'fuzzy').length,
    semantic: combined.filter((v) => v.matchType === 'semantic').length,
    regex: 0,
    range: 0,
    total: combined.length,
  };

  const response: SearchResponse<TVerse> = {
    results,
    counts,
    pagination: {
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    },
  };

  if (cache) {
    cache.set(cacheKey, response);
  }

  return response;
};
