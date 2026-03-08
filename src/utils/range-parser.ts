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

  const sura = Number(match[1]);
  const startAyaRaw = match[2] ? Number(match[2]) : undefined;
  const endAyaRaw = match[3] ? Number(match[3]) : undefined;

  // Validate sura range
  if (sura < 1 || sura > MAX_SURA) return null;

  // Validate aya numbers when present
  if (startAyaRaw !== undefined && startAyaRaw < 1) return null;
  if (endAyaRaw !== undefined) {
    if (endAyaRaw < 1) return null;
    if (startAyaRaw !== undefined && endAyaRaw < startAyaRaw) return null;
  }

  const result: ParsedRange = { sura };
  if (startAyaRaw !== undefined) result.startAya = startAyaRaw;
  if (endAyaRaw !== undefined) result.endAya = endAyaRaw;

  return result;
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
