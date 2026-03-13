import { VerseInput, BooleanQuery } from '../../types';
import { normalizeArabic } from '../../utils/normalization';

/**
 * Checks if a query string contains boolean operators (+, -, |).
 * @param query - The search query to check.
 * @returns True if the query contains any boolean operators, false otherwise.
 * @example
 * hasBooleanOperators("+الله -الرحمن") // Returns: true
 * @example
 * hasBooleanOperators("الله الرحمن") // Returns: false
 */
export function hasBooleanOperators(query: string): boolean {
  return ['+', '-', '|'].some((op) => query.includes(op));
}

/**
 * Removes all boolean operators from a query string and normalizes whitespace.
 * This creates a clean query for normal search processing.
 * @param query - The search query containing boolean operators.
 * @returns The query with operators removed and whitespace normalized.
 * @example
 * clearBooleanOperators("+الله | الرحمن -الجحيم")
 * // Returns: "الله الرحمن الجحيم"
 * @example
 * clearBooleanOperators("محمد | رسول")
 * // Returns: "محمد رسول"
 */
export function clearBooleanOperators(query: string): string {
  return query
    .replace(/[+|\\-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
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
 * Filters search results using boolean logic operators.
 * * This is a **filter function**, not a search function. It takes existing search results
 *   and filters them based on boolean operators. The actual searching (simple/lemma/root/fuzzy/semantic)
 *   is done before this filter is applied.
 * * Supports three boolean operators for precise query control:
 * - **MUST (+)**: Term must appear in the verse text (AND logic)
 * - **EXCLUDE (-)**: Term must NOT appear in the verse text (NOT logic)
 * - **EITHER (|)**: At least one term must appear in the verse text (OR logic)
 * * All matching is case-insensitive and uses substring matching on the verse's standard text.
 * @template TVerse - The type of verse objects in the collection.
 * @param parsedBooleanQuery - The parsed boolean query object with must/exclude/either arrays.
 * @param matches - Array of verses to filter (from previous search layers).
 * @returns Filtered array of verses that satisfy all boolean conditions.
 * @example
 * // Filter verses to find ones with "الله" but not "الرحمن", and either "الرحيم" or "العليم"
 * const parsed = parseBooleanQuery("+الله -الرحمن الرحيم | العليم");
 * const filtered = performBooleanSearch(parsed, searchResults);
 * // Returns only verses containing الله, not containing الرحمن, and containing الرحيم OR العليم
 * @example
 * // Filter for verses with both "النار" and "الجنة"
 * const parsed = parseBooleanQuery("+النار +الجنة");
 * const filtered = performBooleanSearch(parsed, searchResults);
 * // Returns only verses containing both terms
 * @example
 * // Filter for verses with "محمد" or "رسول" but not "كافر"
 * const parsed = parseBooleanQuery("محمد | رسول -كافر");
 * const filtered = performBooleanSearch(parsed, searchResults);
 * // Returns verses with either محمد or رسول, excluding any with كافر
 */
export function performBooleanSearch<TVerse extends VerseInput>(
  parsedBooleanQuery: BooleanQuery,
  matches: TVerse[],
): TVerse[] {
  // 0. Destructure and normalize the parsed boolean query terms
  // Normalization removes diacritics so '+ٱللَّهِ' becomes 'الله' and matches verse text
  const { must, exclude, either } = parsedBooleanQuery;
  const normalizedMust = must.map((term) => normalizeArabic(term));
  const normalizedExclude = exclude.map((term) => normalizeArabic(term));
  const normalizedEither = either.map((term) => normalizeArabic(term));

  // 1. Initialize an empty array to store the boolean matches
  const booleanMatches: TVerse[] = [];

  // 2. Loop through each verse and check if it matches the boolean query
  matches.forEach((verse) => {
    // Normalize verse text for comparison (removes diacritics, etc.)
    const verseText = normalizeArabic(verse.standard);

    // MUST: ALL must terms must appear in verse
    const hasMust = normalizedMust.every((term) => verseText.includes(term));
    if (!hasMust) return;

    // EXCLUDE: NO exclude terms should appear
    const hasExclude = normalizedExclude.some((term) => verseText.includes(term));
    if (hasExclude) return;

    // Either: At least one term should appear
    const hasEither = normalizedEither.some((term) => verseText.includes(term));
    if (!hasEither && normalizedEither.length > 0) return;

    // 3.If all conditions are met, add the verse to the boolean matches
    booleanMatches.push(verse);
  });
  // 4. Return the array of boolean matches
  return booleanMatches;
}
