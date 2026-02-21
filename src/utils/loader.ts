import type { MorphologyAya, WordMap, QuranText, InvertedIndex } from '../types';
import { normalizeArabic } from './normalization';

/**
 * Lazily loads the Quran morphology data.
 * This large dataset is loaded asynchronously to avoid increasing the initial bundle size.
 *
 * @returns A Promise that resolves to a Map where the key is the verse GID and value is morphology data.
 */
export const loadMorphology = async (): Promise<Map<number, MorphologyAya>> => {
  try {
    // Dynamic import for code splitting
    const morphologyModule = await import('../data/morphology.json');

    // The JSON is likely an array (or has a 'default' property if it's a module).
    // We handle both cases to be safe with different bundlers.
    const morphologyArray = (morphologyModule.default || morphologyModule) as MorphologyAya[];

    // Transform array to Map for O(1) access
    const morphologyMap = new Map<number, MorphologyAya>();
    for (const item of morphologyArray) {
      if (item && typeof item.gid === 'number') {
        morphologyMap.set(item.gid, item);
      }
    }

    return morphologyMap;
  } catch (error) {
    console.error('Failed to load morphology data:', error);
    throw new Error('Could not load morphology data. Ensure src/data/morphology.json exists.');
  }
};

/**
 * Lazily loads the Word Map data.
 * This large dataset is loaded asynchronously to avoid increasing the initial bundle size.
 *
 * @returns A Promise that resolves to the WordMap object.
 */
export const loadWordMap = async (): Promise<WordMap> => {
  try {
    const wordMapModule = await import('../data/word-map.json');
    return (wordMapModule.default || wordMapModule) as WordMap;
  } catch (error) {
    console.error('Failed to load word map:', error);
    throw new Error('Could not load word map data. Ensure src/data/word-map.json exists.');
  }
};

/**
 * Lazily loads the Quran text data.
 *
 * @returns A Promise that resolves to an array of QuranText objects.
 */
export const loadQuranData = async (): Promise<QuranText[]> => {
  try {
    const quranModule = await import('../data/quran.json');
    return (quranModule.default || quranModule) as QuranText[];
  } catch (error) {
    console.error('Failed to load Quran data:', error);
    throw new Error('Could not load Quran data. Ensure src/data/quran.json exists.');
  }
};

/**
 * Builds inverted indices from the morphology map.
 * Iterates all morphology entries once and creates:
 * - lemmaIndex: lemma → Set of GIDs
 * - rootIndex: root → Set of GIDs
 *
 * This replaces O(n) linear scans with O(1) lookups during search.
 * Note: Lemmas and roots in morphology.json are already normalized
 *
 * @param morphologyMap The morphology map (from loadMorphology).
 * @returns An InvertedIndex containing both lemmaIndex and rootIndex.
 */
export const buildInvertedIndex = (
  morphologyMap: Map<number, MorphologyAya>,
  quranData: QuranText[],
): InvertedIndex => {
  const lemmaIndex = new Map<string, Set<number>>();
  const rootIndex = new Map<string, Set<number>>();
  const wordIndex = new Map<string, Set<number>>();

  for (const [_, morph] of morphologyMap) {
    const gid = morph.gid;
    // Index each lemma
    if (morph.lemmas) {
      for (const lemma of morph.lemmas) {
        let gids = lemmaIndex.get(lemma);
        if (!gids) {
          gids = new Set<number>();
          lemmaIndex.set(lemma, gids);
        }
        gids.add(gid);
      }
    }

    // Index each root
    if (morph.roots) {
      for (const root of morph.roots) {
        let gids = rootIndex.get(root);
        if (!gids) {
          gids = new Set<number>();
          rootIndex.set(root, gids);
        }
        gids.add(gid);
      }
    }
  }

  // Index words from verse standard text (already tashkeel-free)
  for (const verse of quranData) {
    const normalized = normalizeArabic(verse.standard);
    const words = normalized.split(/\s+/);
    for (const word of words) {
      if (word) {
        let gids = wordIndex.get(word);
        if (!gids) {
          gids = new Set<number>();
          wordIndex.set(word, gids);
        }
        gids.add(verse.gid);
      }
    }
  }

  return { lemmaIndex, rootIndex, wordIndex };
};

/**
 * Lazily loads the pre-built inverted index from static JSON files.
 * The JSON files contain plain objects ({ key: number[] }),
 * which are reconstructed into Map<string, Set<number>> structures.
 *
 * @returns A Promise that resolves to an InvertedIndex.
 */
export const loadInvertedIndex = async (): Promise<InvertedIndex> => {
  try {
    const [lemmaModule, rootModule, wordModule] = await Promise.all([
      import('../data/lemma-index.json'),
      import('../data/root-index.json'),
      import('../data/word-index.json'),
    ]);

    const lemmaRaw = (lemmaModule.default || lemmaModule) as Record<string, number[]>;
    const rootRaw = (rootModule.default || rootModule) as Record<string, number[]>;
    const wordRaw = (wordModule.default || wordModule) as Record<string, number[]>;
    const lemmaIndex = new Map<string, Set<number>>();
    for (const [key, gids] of Object.entries(lemmaRaw)) {
      lemmaIndex.set(key, new Set(gids));
    }

    const rootIndex = new Map<string, Set<number>>();
    for (const [key, gids] of Object.entries(rootRaw)) {
      rootIndex.set(key, new Set(gids));
    }

    const wordIndex = new Map<string, Set<number>>();
    for (const [key, gids] of Object.entries(wordRaw)) {
      wordIndex.set(key, new Set(gids));
    }

    return { lemmaIndex, rootIndex, wordIndex };
  } catch (error) {
    console.error('Failed to load inverted index:', error);
    throw new Error(
      'Could not load inverted index data. Ensure src/data/lemma-index.json, src/data/root-index.json, and src/data/word-index.json exist.',
    );
  }
};
