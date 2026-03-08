import { normalizeArabic } from '../../utils/normalization';
import type { VerseInput, WordIndex } from '../../types';

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
  data: TVerse[],
  suraId?: number,
  juzId?: number,
  suraName?: string,
): TVerse[] => {
  // 1. Priority: suraId — return results even if empty (filter was explicitly requested)
  if (typeof suraId === 'number' && suraId > 0) {
    const results = data.filter((v) => v['sura_id'] === suraId);
    return results;
  }

  // 2. Priority: suraName
  if (suraName) {
    const normalizedQuery = normalizeArabic(suraName).toLowerCase().trim();
    if (normalizedQuery) {
      return data.filter((verse) => {
        const normalizedSuraName = verse['sura_name']
          ? normalizeArabic(verse['sura_name'] as string)
          : '';
        const enName = ((verse['sura_name_en'] as string) || '').toLowerCase();
        const romName = ((verse['sura_name_romanization'] as string) || '').toLowerCase();
        return (
          normalizedSuraName.includes(normalizedQuery) ||
          enName.includes(normalizedQuery) ||
          romName.includes(normalizedQuery)
        );
      });
    }
  }

  // 3. Priority: juzId
  if (juzId !== undefined) {
    const results = data.filter((v) => v['juz_id'] === juzId);
    return results;
  }

  // 4. Fallback: Return original data (no filter was provided)
  return data;
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
  items: T[],
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
        for (const gid of matchingGids) {
          if (!gids.has(gid)) matchingGids.delete(gid);
        }
        if (matchingGids.size === 0) return [];
      }
    }

    if (!matchingGids || matchingGids.size === 0) return [];
    return items.filter((item) => matchingGids!.has(item['gid'] as number));
  }

  // Fallback: linear scan
  return items.filter((item) => {
    const fieldValue = normalizeArabic(String(item[searchField] || ''));
    // AND logic: All tokens must be present
    return queryTokens.every((token) => fieldValue.includes(token));
  });
};
