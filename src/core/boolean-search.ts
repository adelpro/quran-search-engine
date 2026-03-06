import { computeScore, search } from './search';
import { LRUCache } from './lru-cache';
import {
  AdvancedSearchOptions,
  InvertedIndex,
  MorphologyAya,
  PaginationOptions,
  SearchCounts,
  SearchResponse,
  VerseInput,
  WordMap,
  BooleanQuery,
} from '../types';
import Fuse from 'fuse.js';

// ==================== Boolean Query Parser ====================

/**
 * Parses a boolean search query into structured components.
 * * Supports three operators:
 * - `+term` (MUST): The term must appear in results
 * - `-term` (EXCLUDE): The term must NOT appear in results
 * - `term | term` (EITHER/OR): At least one of the terms must appear
 * * Bare terms (without operators) are treated as OR terms.
 * * Multiple operators can be combined in a single query.
 * @param rawQuery - The raw boolean search string from the user.
 * @returns A structured BooleanQuery object with must, exclude, and either arrays.
 * @example
 * parseBooleanQuery("+grace -hell fire | water")
 * // Returns: { must: ["grace"], exclude: ["hell"], either: ["fire", "water"] }
 * @example
 * parseBooleanQuery("+الله +الرحمن -الجحيم")
 * // Returns: { must: ["الله", "الرحمن"], exclude: ["الجحيم"], either: [] }
 */
function parseBooleanQuery(rawQuery: string): BooleanQuery {
  const result: BooleanQuery = { must: [], exclude: [], either: [] };

  // Tokenize the query by splitting on whitespace
  // e.g., "fire | water -hell +grace" → ["fire", "|", "water", "-hell", "+grace"]
  const tokens = rawQuery.trim().split(/\s+/);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Skip standalone pipe operators (handled as part of OR groups below)
    if (token === '|') {
      i++;
      continue;
    }

    // MUST operator: +term
    if (token.startsWith('+')) {
      const term = token.slice(1).toLowerCase();
      if (term) result.must.push(term);
    }
    // EXCLUDE operator: -term
    else if (token.startsWith('-')) {
      const term = token.slice(1).toLowerCase();
      if (term) result.exclude.push(term);
    }
    // EITHER (OR) operator: bare terms or "term | term | term"
    else {
      // Collect all terms in an OR chain (e.g., "fire | water | ice")
      const orGroup: string[] = [token.toLowerCase()];
      // Look ahead: if next token is "|", it's part of an OR group
      while (tokens[i + 1] === '|' && tokens[i + 2]) {
        i += 2; // Skip the "|" and move to the next term
        orGroup.push(tokens[i].toLowerCase());
      }
      // Add all OR terms to the either array
      result.either.push(...orGroup);
    }

    i++;
  }

  return result;
}

// ==================== Boolean Search API ====================

/**
 * Performs a boolean search across the Quran using logical operators.
 * * Supports three boolean operators for precise query control:
 * - **MUST (+)**: Term must appear in results (AND logic)
 * - **EXCLUDE (-)**: Term must NOT appear in results (NOT logic)
 * - **EITHER (|)**: At least one term must appear (OR logic)
 * * The search delegates to the main `search()` function for each term,
 * leveraging all existing features (lemma/root matching, fuzzy search, etc.),
 * then combines results using Set operations on verse GIDs.
 * * Results are scored, deduplicated, sorted by relevance, and paginated.
 * @template TVerse - The type of verse objects in the collection.
 * @param query - The boolean search query string (e.g., "+grace -hell fire | water").
 * @param quranData - The verse dataset to search through.
 * @param morphologyMap - Morphological data for linguistic analysis.
 * @param wordMap - Dictionary for lemma/root resolution.
 * @param options - Search configuration (toggle lemma/root/fuzzy/semantic matching).
 * @param pagination - Page number and results per page.
 * @param preComputedFuseIndex - Optional pre-built Fuse.js index for fuzzy matching.
 * @param cache - Optional LRU cache for performance optimization.
 * @param invertedIndex - Optional pre-built word/lemma/root indexes for O(1) lookups.
 * @returns Paginated search results with metadata and match counts.
 * @example
 * // Find verses with "الله" but not "الرحمن", and must have either "الرحيم" or "العليم"
 * const result = booleanSearch(
 *   "+الله -الرحمن الرحيم | العليم",
 *   quranData,
 *   morphologyMap,
 *   wordMap,
 *   { lemma: true, root: true },
 *   { page: 1, limit: 10 }
 * );
 * @example
 * // Find verses with both "النار" and "الجنة" (MUST have both)
 * const result = booleanSearch(
 *   "+النار +الجنة",
 *   quranData,
 *   morphologyMap,
 *   wordMap
 * );
 * @example
 * // Find verses with "محمد" or "رسول" but exclude "كافر"
 * const result = booleanSearch(
 *   "محمد | رسول -كافر",
 *   quranData,
 *   morphologyMap,
 *   wordMap
 * );
 */
export function booleanSearch<TVerse extends VerseInput>(
  query: string,
  quranData: TVerse[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
  preComputedFuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
  invertedIndex?: InvertedIndex,
): SearchResponse<TVerse> {
  // 0. Parse boolean query into structured components
  const parsed = parseBooleanQuery(query);

  /**
   * Helper function: Retrieves all verse GIDs (Global IDs) that match a single term.
   * Delegates to the main search() function to leverage lemma/root/fuzzy matching.
   * @param term - A single search term (already extracted from boolean query).
   * @returns A Set of verse GIDs that contain the term.
   */
  const getGidsForTerm = (term: string): Set<number> => {
    const result = search(
      term,
      quranData,
      morphologyMap,
      wordMap,
      options,
      { page: 1, limit: 6500 }, // Get ALL results for this term
      preComputedFuseIndex,
      undefined, // Don't cache intermediate results
      invertedIndex,
    );
    return new Set(result.results.map((v) => v.gid));
  };

  // 1. Check cache for existing results
  const cacheKey = cache ? JSON.stringify({ query, options, pagination }) : '';
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  // 2. Initialize with all verses (will be filtered down by boolean logic)
  let resultGids = new Set<number>(quranData.map((v) => v.gid));

  // 3. Apply MUST terms (intersection - all must match)
  for (const term of parsed.must) {
    const termGids = getGidsForTerm(term);
    // Keep only verses that have this MUST term
    resultGids = new Set([...resultGids].filter((gid) => termGids.has(gid)));
    if (resultGids.size === 0) break; // Short-circuit: no results possible
  }

  // 4. Apply EXCLUDE terms (difference - remove unwanted verses)
  for (const term of parsed.exclude) {
    const termGids = getGidsForTerm(term);
    // Remove all verses that contain this EXCLUDE term
    resultGids = new Set([...resultGids].filter((gid) => !termGids.has(gid)));
  }

  // 5. Apply EITHER terms (union then intersection - at least one must match)
  if (parsed.either.length > 0) {
    const eitherGids = new Set<number>();
    // Collect all verses that match ANY of the EITHER terms
    for (const term of parsed.either) {
      const termGids = getGidsForTerm(term);
      termGids.forEach((gid) => eitherGids.add(gid));
    }
    // Keep only verses that have at least one EITHER term
    resultGids = new Set([...resultGids].filter((gid) => eitherGids.has(gid)));
  }

  // 6. Convert GIDs back to verse objects and compute relevance scores
  const gidMap = new Map(quranData.map((v) => [v.gid, v]));
  const combined = Array.from(resultGids)
    .map((gid) => gidMap.get(gid))
    .filter((v): v is TVerse => v !== undefined)
    .map((verse) =>
      computeScore(
        verse,
        query.replace(/[+\-|]/g, '').trim(), // Clean query (remove operators) for scoring
        morphologyMap,
        wordMap,
        options,
      ),
    );

  // 7. Sort by relevance score (highest to lowest)
  combined.sort((a, b) => b.matchScore - a.matchScore);

  // 8. Apply pagination
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  const offset = (page - 1) * limit;
  const results = combined.slice(offset, offset + limit);

  // 9. Build search metadata and counts
  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: combined.filter((v) => v.matchType === 'lemma').length,
    root: combined.filter((v) => v.matchType === 'root').length,
    fuzzy: combined.filter((v) => v.matchType === 'fuzzy').length,
    semantic: combined.filter((v) => v.matchType === 'semantic').length,
    range: 0,
    total: combined.length,
  };

  // 10. Construct final response with results, counts, and pagination metadata
  const response: SearchResponse<TVerse> = {
    results,
    counts,
    pagination: {
      totalResults: combined.length,
      totalPages: Math.ceil(combined.length / limit),
      currentPage: page,
      limit,
    },
  };

  // 11. Cache the response for future identical queries
  if (cache) {
    cache.set(cacheKey, response);
  }

  return response;
}
