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
} from '../../types';

export function hasBooleanOperators(query: string): boolean {
  return ['+', '-', '|'].some((op) => query.includes(op));
}

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
export function parseBooleanQuery(rawQuery: string): BooleanQuery {
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
  parsedBooleanQuery: BooleanQuery,
  matches: TVerse[],
): TVerse[] {
  // const parsed = parseBooleanQuery(query);

  const { must, exclude, either } = parsedBooleanQuery;

  const booleanMatches: TVerse[] = [];

  matches.forEach((verse) => {
    const verseText = verse.standard.toLowerCase();

    // MUST: ALL must terms must appear in verse
    const hasMust = must.every((term) => verseText.includes(term));
    if (!hasMust) return;

    // EXCLUDE: NO exclude terms should appear
    const hasExclude = exclude.some((term) => verseText.includes(term));
    if (hasExclude) return;

    // Either: At least one term should appear
    const hasEither = either.some((term) => verseText.includes(term));
    if (!hasEither && either.length > 0) return;

    booleanMatches.push(verse);
  });

  return booleanMatches;
}
