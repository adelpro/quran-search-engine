import Fuse, { type IFuseOptions } from 'fuse.js';
import { normalizeArabic } from '../utils/normalization';
import type { QuranText, WordMap, MorphologyAya, AdvancedSearchOptions } from '../types';

// ==================== Fuse.js Setup ====================
export const createArabicFuseSearch = <T>(
  collection: T[],
  keys: string[],
  options: Partial<IFuseOptions<T>> = {},
): Fuse<T> =>
  new Fuse(collection, {
    includeScore: true,
    threshold: 0.3, // stricter match
    distance: 50,
    ignoreLocation: true,
    minMatchCharLength: 2,
    useExtendedSearch: true,
    keys,
    ...options,
  });

// ==================== Simple Search ====================
export const simpleSearch = <T extends Record<string, any>>(
  items: T[],
  query: string,
  searchField: keyof T,
): T[] => {
  // Keep only Arabic letters and spaces
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  return items.filter((item) => {
    const fieldValue = String(item[searchField] || '');
    return normalizeArabic(fieldValue).includes(cleanQuery);
  });
};

// ==================== Advanced Linguistic Search ====================
export const performAdvancedLinguisticSearch = (
  query: string,
  quranData: QuranText[],
  options: AdvancedSearchOptions,
  fuseInstance: Fuse<QuranText>,
  wordMap: WordMap,
  morphologyMap: Map<number, MorphologyAya>
): QuranText[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const entry = wordMap[cleanQuery];
  
  // Fallback to fuzzy search if no dictionary entry found
  if (!entry) return fuseInstance.search(cleanQuery).map((r) => r.item);

  const { lemma: targetLemma, root: targetRoot = '' } = entry;
  const matchingGids = new Set<number>();

  if (options.lemma && targetLemma) {
    for (const verse of quranData) {
      const morph = morphologyMap.get(verse.gid);
      if (morph?.lemmas.includes(targetLemma)) matchingGids.add(verse.gid);
    }
  }

  if (options.root && targetRoot) {
    for (const verse of quranData) {
      const morph = morphologyMap.get(verse.gid);
      if (morph?.roots.includes(targetRoot)) matchingGids.add(verse.gid);
    }
  }

  if (matchingGids.size > 0) {
    const gidToVerse = new Map(quranData.map((v) => [v.gid, v]));
    return Array.from(matchingGids).map((gid) => gidToVerse.get(gid)!);
  }

  return fuseInstance.search(cleanQuery).map((r) => r.item);
};
