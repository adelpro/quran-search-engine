import Fuse, { type FuseResultMatch } from 'fuse.js';
import { normalizeArabic } from '../../utils/normalization';
import type {
  VerseInput,
  WordMap,
  MorphologyAya,
  AdvancedSearchOptions,
  LemmaIndex,
  RootIndex,
  VerseWithFuseMatches,
} from '../../types';

/**
 * Executes a multi-layered linguistic search using roots, lemmas, and fuzzy matching.
 * * The search follows an "AND" logic (intersection), where all query tokens must
 * match a verse via one of the following methods (in priority order):
 * 1. Linguistic Root/Lemma lookup (via inverted index or linear scan).
 * 2. Fuzzy search (via Fuse.js) with adaptive scoring thresholds.
 * @param query - The raw search string.
 * @param quranData - The dataset to search.
 * @param options - Search configuration (toggle lemma/root/fuzzy).
 * @param fuseInstance - A pre-configured Fuse.js instance for fuzzy fallback.
 * @param wordMap - Dictionary for resolving tokens to roots/lemmas.
 * @param morphologyMap - Detailed linguistic data for every verse.
 * @param lemmaIndex - (Optional) Inverted index for fast lemma lookups.
 * @param rootIndex - (Optional) Inverted index for fast root lookups.
 * @returns Array of verses matching all tokens.
 */
export const performAdvancedLinguisticSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: Map<number, TVerse>,
  options: AdvancedSearchOptions,
  fuseInstance: Fuse<TVerse> | null,
  wordMap: WordMap,
  morphologyMap: Map<number, MorphologyAya>,
  lemmaIndex?: LemmaIndex,
  rootIndex?: RootIndex,
): VerseWithFuseMatches<TVerse>[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/);

  // 1. Identify which verses match EACH token
  const tokenMatches = tokens.map((token) => {
    const entry = wordMap.get(token);
    const matchingGids = new Set<number>();

    // Linguistic search if dictionary entry exists
    if (entry) {
      const { lemma: targetLemma, root: targetRoot } = entry;

      if (options.lemma && targetLemma) {
        if (lemmaIndex) {
          // O(1) lookup via inverted index
          const gidsFromIndex = lemmaIndex.get(targetLemma);
          if (gidsFromIndex) {
            Array.from(gidsFromIndex).forEach((gid) => matchingGids.add(gid));
          }
        } else {
          // Fallback: linear scan (legacy path)
          const normalizedLemma = normalizeArabic(targetLemma);
          for (const verse of quranData.values()) {
            const morph = morphologyMap.get(verse.gid);
            if (morph?.lemmas.some((lemma) => normalizeArabic(lemma).includes(normalizedLemma))) {
              matchingGids.add(verse.gid);
            }
          }
        }
      }

      if (options.root && targetRoot) {
        if (rootIndex) {
          // O(1) lookup via inverted index
          const gidsFromIndex = rootIndex.get(targetRoot);
          if (gidsFromIndex) {
            Array.from(gidsFromIndex).forEach((gid) => matchingGids.add(gid));
          }
        } else {
          // Fallback: linear scan (legacy path)
          const normalizedRoot = normalizeArabic(targetRoot);
          for (const verse of quranData.values()) {
            const morph = morphologyMap.get(verse.gid);
            if (morph?.roots.some((root) => normalizeArabic(root).includes(normalizedRoot))) {
              matchingGids.add(verse.gid);
            }
          }
        }
      }

      if (matchingGids.size > 0) {
        return { type: 'linguistic', gids: matchingGids };
      }
    }

    // Fallback to Fuzzy/Fuse for this token if no linguistic match
    if (options.fuzzy === false || !fuseInstance) {
      return { type: 'fuzzy', gids: new Set<number>() };
    }

    const fuseResults = fuseInstance.search(token);

    // Adaptive threshold for this token
    const hasHighQualityMatches = fuseResults.some(
      (res) => res.score !== undefined && res.score <= 0.25,
    );
    const cutoff = hasHighQualityMatches ? 0.35 : 0.5;

    const fuzzyGids = new Set<number>();
    const fuseMatchesMap = new Map<number, readonly FuseResultMatch[]>();

    fuseResults
      .filter((res) => res.score !== undefined && res.score <= cutoff)
      .forEach((res) => {
        fuzzyGids.add(res.item.gid);
        if (res.matches) fuseMatchesMap.set(res.item.gid, res.matches);
      });

    return { type: 'fuzzy', gids: fuzzyGids, fuseMatches: fuseMatchesMap };
  });

  // 2. Intersect results (AND logic)
  if (tokenMatches.length === 0) return [];

  // Start with the first set
  let intersection = new Set(tokenMatches[0].gids);

  for (let i = 1; i < tokenMatches.length; i++) {
    const currentGids = tokenMatches[i].gids;
    if (currentGids.size === 0) return []; // Short-circuit
    intersection = new Set([...intersection].filter((gid) => currentGids.has(gid)));
    if (intersection.size === 0) return [];
  }

  if (intersection.size === 0) return [];

  // 3. Map back to QuranText objects natively (O(1))

  const results: VerseWithFuseMatches<TVerse>[] = Array.from(intersection)
    .map((gid): VerseWithFuseMatches<TVerse> | null => {
      const verse = quranData.get(gid);
      if (!verse) return null;

      const allFuseMatches: FuseResultMatch[] = [];

      tokenMatches.forEach((tokenMatch) => {
        if (tokenMatch.type === 'fuzzy' && tokenMatch.fuseMatches) {
          const matches = tokenMatch.fuseMatches.get(gid);
          if (matches) allFuseMatches.push(...matches);
        }
      });

      return {
        ...verse,
        fuseMatches: allFuseMatches.length > 0 ? [...allFuseMatches] : undefined,
      };
    })
    .filter((verse): verse is VerseWithFuseMatches<TVerse> => verse !== null);

  return results;
};
