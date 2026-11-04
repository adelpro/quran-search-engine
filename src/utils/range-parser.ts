import type { ParsedRange, VerseInput } from '../types';

/** Maximum valid sura number in the Quran. */
const MAX_SURA = 114;

/**
 * Regex matching range query patterns:
 *   - `2:255`   → single verse
 *   - `1:1-7`   → verse range
 *   - `2:`      → entire sura
 *
 * Captures: (sura) : (startAya)? (- endAya)?
 */
const RANGE_QUERY_REGEX = /^\s*(\d{1,3})\s*:\s*(?:(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?\s*$/;

/**
 * Regex matching a range prefix followed by a text query:
 *   - `1:1-4 العالمين` → text search inside Al-Fatihah 1–4
 *   - `2: mercy`       → text search inside the whole of Al-Baqarah
 *
 * Captures: (sura) : (startAya)? (- endAya)? then the remaining query.
 */
const RANGE_SCOPED_QUERY_REGEX =
  /^\s*(\d{1,3})\s*:\s*(?:(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?\s+(\S[\s\S]*)$/;

/** A validated range plus the text query it should scope. */
export type RangeScopedQuery = {
  range: ParsedRange;
  query: string;
};

const isValidCoordinateRange = (sura: number, startAya?: number, endAya?: number): boolean => {
  if (sura < 1 || sura > MAX_SURA) return false;
  if (startAya !== undefined && startAya < 1) return false;
  if (endAya === undefined) return true;
  if (endAya < 1) return false;
  return startAya === undefined || endAya >= startAya;
};

const buildRange = (
  suraRaw: string,
  startAyaRawQuery?: string,
  endAyaRawQuery?: string,
): ParsedRange | null => {
  const sura = Number(suraRaw);
  const startAyaRaw = startAyaRawQuery ? Number(startAyaRawQuery) : undefined;
  const endAyaRaw = endAyaRawQuery ? Number(endAyaRawQuery) : undefined;

  if (!isValidCoordinateRange(sura, startAyaRaw, endAyaRaw)) return null;

  const result: ParsedRange = { sura };
  if (startAyaRaw !== undefined) result.startAya = startAyaRaw;
  if (endAyaRaw !== undefined) result.endAya = endAyaRaw;

  return result;
};

/**
 * Parses a query string into sura/aya coordinates.
 *
 * Returns `null` if the query is not a valid range query.
 *
 * @param query - The raw search query string.
 * @returns A {@link ParsedRange} object, or `null` for non-range queries.
 *
 * @example
 * parseRangeQuery('2:255');  // { sura: 2, startAya: 255 }
 * parseRangeQuery('1:1-7');  // { sura: 1, startAya: 1, endAya: 7 }
 * parseRangeQuery('2:');     // { sura: 2 }
 * parseRangeQuery('hello');  // null
 */
export const parseRangeQuery = (query: string): ParsedRange | null => {
  const match = RANGE_QUERY_REGEX.exec(query);
  if (!match) return null;

  return buildRange(match[1], match[2], match[3]);
};

/**
 * Parses a range prefix plus a text query, e.g. `1:1-4 العالمين`.
 *
 * The range must come first and be separated from the text by whitespace. Returns
 * `null` when there is no text query or when the coordinate prefix is invalid, so
 * the caller can fall back to a normal search.
 *
 * @param query - The raw search query string.
 * @returns The validated range and remaining query, or `null`.
 *
 * @example
 * parseRangeScopedQuery('1:1-4 العالمين');
 * // { range: { sura: 1, startAya: 1, endAya: 4 }, query: 'العالمين' }
 * parseRangeScopedQuery('1:1-4'); // null — use parseRangeQuery for coordinate-only lookups
 */
export const parseRangeScopedQuery = (query: string): RangeScopedQuery | null => {
  const match = RANGE_SCOPED_QUERY_REGEX.exec(query);
  if (!match) return null;

  const range = buildRange(match[1], match[2], match[3]);
  if (!range) return null;

  const textQuery = match[4].trim();
  if (!textQuery) return null;

  return { range, query: textQuery };
};

/**
 * Filters verses by the given range coordinates.
 *
 * Requires the verses to have `sura_id` and `aya_id` properties.
 * Returns an empty array if the data does not contain these fields.
 *
 * @param verses - The full set of verses to filter.
 * @param range - A parsed range from {@link parseRangeQuery}.
 * @returns The matching verses in their original order.
 *
 * @example
 * const range = parseRangeQuery('1:1-3');
 * const verses = filterVersesByRange(quranData, range!);
 */
export const filterVersesByRange = <TVerse extends VerseInput>(
  verses: TVerse[],
  range: ParsedRange,
): TVerse[] => {
  return verses.filter((verse) => {
    // Gracefully skip verses without coordinate fields
    if (verse.sura_id === undefined || verse.aya_id === undefined) return false;

    if (verse.sura_id !== range.sura) return false;

    // Entire sura — no aya constraints
    if (range.startAya === undefined) return true;

    // Range query (e.g. 1:1-7)
    if (range.endAya !== undefined) {
      return verse.aya_id >= range.startAya && verse.aya_id <= range.endAya;
    }

    // Single verse (e.g. 2:255)
    return verse.aya_id === range.startAya;
  });
};
