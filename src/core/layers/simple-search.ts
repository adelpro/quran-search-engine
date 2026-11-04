import { normalizeArabic } from '../../utils/normalization';
import type { VerseInput, WordIndex } from '../../types';

/**
 * Tests whether a verse belongs to the sura named by `suraName`.
 *
 * Arabic names are compared after normalization; Latin names are compared against both
 * `sura_name_en` and `sura_name_romanization` case-insensitively.
 *
 * @param verse - The verse whose `sura_name` fields should be checked.
 * @param suraName - Arabic, English, or romanized sura name.
 * @returns `true` when the verse's sura metadata matches the requested name.
 */
export const matchesSuraName = (verse: VerseInput, suraName: string): boolean => {
  const rawQuery = suraName.toLowerCase().trim();
  if (!rawQuery) return false;

  const isArabicQuery = /[\u0600-\u06FF]/.test(suraName);
  if (isArabicQuery) {
    const normalizedQuery = normalizeArabic(suraName).toLowerCase().trim();
    // An Arabic name made only of digits or diacritics normalizes to '', and
    // ''.includes('') would match every verse. Treat it as an explicit miss.
    if (!normalizedQuery) return false;

    const normalizedSuraName = verse['sura_name']
      ? normalizeArabic(verse['sura_name'] as string).toLowerCase()
      : '';
    return normalizedSuraName.includes(normalizedQuery);
  }

  const enName = ((verse['sura_name_en'] as string) || '').toLowerCase();
  const romName = ((verse['sura_name_romanization'] as string) || '').toLowerCase();
  return enName.includes(rawQuery) || romName.includes(rawQuery);
};

/**
 * Filters a collection of verses based on Surah ID, Surah Name, or Juz ID.
 * * **Filter Priority:**
 * 1. `suraId` (Highest priority, strict match)
 * 2. `suraName` (Matches against Arabic, English, or Romanized names)
 * 3. `juzId` (Lowest priority, strict match)
 * * If multiple filters are provided, only the highest priority one is executed.
 * If no filters are provided, the original data is returned.
 * @param data - An array of verses to filter
 * @param suraId - Optional Surah number (1-114)
 * @param juzId - Optional Juz number (1-30)
 * @param suraName - Optional string to match against Surah names
 * @returns An array of filtered verses
 */
export const filterVerses = <TVerse extends VerseInput>(
  data: TVerse[] | Map<number, TVerse>,
  suraId?: number,
  juzId?: number,
  suraName?: string,
): TVerse[] => {
  const iterable = data instanceof Map ? Array.from(data.values()) : data;

  // 1. Priority: suraId — return results even if empty (filter was explicitly requested)
  if (typeof suraId === 'number' && suraId > 0) {
    const results = iterable.filter((v) => v['sura_id'] === suraId);
    return results;
  }

  // 2. Priority: suraName
  if (suraName) {
    const rawQuery = suraName.toLowerCase().trim();
    if (rawQuery) {
      return iterable.filter((verse) => matchesSuraName(verse, suraName));
    }
  }

  // 3. Priority: juzId
  if (juzId !== undefined) {
    const results = iterable.filter((v) => v['juz_id'] === juzId);
    return results;
  }

  // 4. Fallback: Return original data (no filter was provided)
  return iterable;
};

/**
 * Performs a high-performance search across a collection of items.
 * * Uses an inverted index (wordIndex) for O(1) lookups if available,
 * otherwise falls back to a linear scan of the specified field.
 * @param items - The collection to search through.
 * @param query - The search string.
 * @param searchField - The property name to search within (used in fallback mode).
 * @param [wordIndex] - An optional pre-computed index mapping words to Global IDs (GIDs).
 * @returns An array of items where all query tokens were found.
 * @example
 * // Fast search using an index
 * const results = simpleSearch(verses, "الحمد لله", "standard", myWordIndex);
 */
export const simpleSearch = <T extends Record<string, unknown>>(
  items: T[] | Map<number, T>,
  query: string,
  searchField: keyof T,
  wordIndex?: WordIndex,
): T[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const queryTokens = cleanQuery.split(/\s+/);

  // Fast path: O(1) lookups via wordIndex
  if (wordIndex) {
    let matchingGids: Set<number> | null = null;

    for (const token of queryTokens) {
      const gids = wordIndex.get(token);
      if (!gids || gids.size === 0) return [];

      if (matchingGids === null) {
        matchingGids = new Set(gids);
      } else {
        // TODO: Replace manual intersection with Set.prototype.intersection();
        // when target is bumped to ES2025
        for (const gid of Array.from(matchingGids)) {
          if (!gids.has(gid)) matchingGids.delete(gid);
        }
        if (matchingGids.size === 0) return [];
      }
    }

    if (!matchingGids || matchingGids.size === 0) return [];

    if (items instanceof Map) {
      const results: T[] = [];
      for (const gid of matchingGids) {
        const item = items.get(gid);
        if (item) results.push(item);
      }
      return results;
    }

    return items.filter((item) => matchingGids!.has(item['gid'] as number));
  }

  const iterable = items instanceof Map ? Array.from(items.values()) : items;

  // Fallback: linear scan
  return iterable.filter((item) => {
    const fieldValue = normalizeArabic(String(item[searchField] || ''));
    // AND logic: All tokens must be present
    return queryTokens.every((token) => fieldValue.includes(token));
  });
};

/**
 * A duplicate function of simpleSearch, but with OR logic
 * @param items - The collection to search through.
 * @param query - The search string.
 * @param searchField - The property name to search within (used in fallback mode).
 * @param [wordIndex] - An optional pre-computed index mapping words to Global IDs (GIDs).
 * @returns An array of items where at least on of tokens was found.
 * @example
 * // Search and get all results containing any of the query tokens
 * const results = simpleSearchOr(verses, "الحمد لله", "standard", myWordIndex);
 */
export const simpleSearchOr = <T extends Record<string, unknown>>(
  items: T[] | Map<number, T>,
  query: string,
  searchField: keyof T,
  wordIndex?: WordIndex,
): T[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const queryTokens = cleanQuery.split(/\s+/);

  // Fast path: O(1) lookups via wordIndex with OR logic
  if (wordIndex) {
    const matchingGids = new Set<number>();

    for (const token of queryTokens) {
      const gids = wordIndex.get(token);
      // Don't return early! Just skip tokens that don't exist
      if (gids && gids.size > 0) {
        // Add ALL gids from this token (union)
        gids.forEach((gid) => matchingGids.add(gid));
      }
    }

    // After loop, check if we found any matches
    if (matchingGids.size === 0) return [];

    if (items instanceof Map) {
      const results: T[] = [];
      for (const gid of matchingGids) {
        const item = items.get(gid);
        if (item) results.push(item);
      }
      return results;
    }

    return items.filter((item) => matchingGids.has(item['gid'] as number));
  }

  const iterable = items instanceof Map ? Array.from(items.values()) : items;

  // Fallback: linear scan with OR logic
  return iterable.filter((item) => {
    const fieldValue = normalizeArabic(String(item[searchField] || ''));
    // Or logic: At least one tokens must be present
    return queryTokens.some((token) => fieldValue.includes(token));
  });
};
