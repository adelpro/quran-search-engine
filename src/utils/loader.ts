import type { MorphologyAya, WordMap, QuranText, InvertedIndex } from '../types';
import { normalizeArabic } from './normalization';
import { DataFileNotFoundError, DataParseError, DataSchemaInvalidError } from '../errors';

/**
 * Lazily loads the Quran morphology data.
 * This large dataset is loaded asynchronously to avoid increasing the initial bundle size.
 *
 * @returns A Promise that resolves to a Map where the key is the verse GID and value is morphology data.
 * @throws {DataFileNotFoundError} When the morphology file cannot be found
 * @throws {DataParseError} When the file cannot be parsed as JSON
 * @throws {DataSchemaInvalidError} When the data structure is invalid
 */
export const loadMorphology = async (path?: string): Promise<Map<number, MorphologyAya>> => {
  const filePath = path || '../data/morphology.json';

  try {
    // Dynamic import for code splitting
    const morphologyModule = await import(filePath);

    // The JSON is likely an array (or has a 'default' property if it's a module).
    // We handle both cases to be safe with different bundlers.
    const morphologyArray = (morphologyModule.default || morphologyModule) as MorphologyAya[];

    // Validate schema
    if (!Array.isArray(morphologyArray)) {
      throw new DataSchemaInvalidError(filePath, 'Expected an array of morphology data');
    }

    // Transform array to Map for O(1) access
    const morphologyMap = new Map<number, MorphologyAya>();
    for (const item of morphologyArray) {
      if (!item || typeof item.gid !== 'number') {
        throw new DataSchemaInvalidError(
          filePath,
          `Invalid morphology entry: missing or invalid gid`,
        );
      }
      if (!Array.isArray(item.lemmas) || !Array.isArray(item.roots)) {
        throw new DataSchemaInvalidError(
          filePath,
          `Invalid morphology entry for GID ${item.gid}: lemmas and roots must be arrays`,
        );
      }
      morphologyMap.set(item.gid, item);
    }

    if (morphologyMap.size === 0) {
      throw new DataSchemaInvalidError(filePath, 'Morphology data is empty');
    }

    return morphologyMap;
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

    // Handle import/parse errors
    if (error instanceof Error) {
      if (
        error.message.includes('Cannot find module') ||
        error.message.includes('Failed to fetch')
      ) {
        throw new DataFileNotFoundError(filePath, error);
      }
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        throw new DataParseError(filePath, error);
      }
    }

    // Generic fallback
    throw new DataParseError(filePath, error);
  }
};

/**
 * Lazily loads the Word Map data.
 * This large dataset is loaded asynchronously to avoid increasing the initial bundle size.
 *
 * @returns A Promise that resolves to the WordMap object.
 * @throws {DataFileNotFoundError} When the word-map file cannot be found
 * @throws {DataParseError} When the file cannot be parsed as JSON
 * @throws {DataSchemaInvalidError} When the data structure is invalid
 */
export const loadWordMap = async (path?: string): Promise<WordMap> => {
  const filePath = path || '../data/word-map.json';

  try {
    const wordMapModule = await import(filePath);
    const wordMap = (wordMapModule.default || wordMapModule) as WordMap;

    // Validate schema
    if (!wordMap || typeof wordMap !== 'object') {
      throw new DataSchemaInvalidError(filePath, 'Expected an object for word map data');
    }

    if (Object.keys(wordMap).length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Word map data is empty');
    }

    return wordMap;
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

    // Handle import/parse errors
    if (error instanceof Error) {
      if (
        error.message.includes('Cannot find module') ||
        error.message.includes('Failed to fetch')
      ) {
        throw new DataFileNotFoundError(filePath, error);
      }
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        throw new DataParseError(filePath, error);
      }
    }

    // Generic fallback
    throw new DataParseError(filePath, error);
  }
};

/**
 * Lazily loads the Quran text data.
 *
 * @returns A Promise that resolves to an array of QuranText objects.
 * @throws {DataFileNotFoundError} When the quran file cannot be found
 * @throws {DataParseError} When the file cannot be parsed as JSON
 * @throws {DataSchemaInvalidError} When the data structure is invalid
 */
export const loadQuranData = async (path?: string): Promise<QuranText[]> => {
  const filePath = path || '../data/quran.json';

  try {
    const quranModule = await import(filePath);
    const quranData = (quranModule.default || quranModule) as QuranText[];

    // Validate schema
    if (!Array.isArray(quranData)) {
      throw new DataSchemaInvalidError(filePath, 'Expected an array of Quran text data');
    }

    if (quranData.length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Quran data is empty');
    }

    // Validate first few entries for required fields
    for (let i = 0; i < Math.min(3, quranData.length); i++) {
      const verse = quranData[i];
      if (!verse || typeof verse.gid !== 'number' || !verse.standard) {
        throw new DataSchemaInvalidError(
          filePath,
          `Invalid Quran entry at index ${i}: missing gid or standard field`,
        );
      }
    }

    return quranData;
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

    // Handle import/parse errors
    if (error instanceof Error) {
      if (
        error.message.includes('Cannot find module') ||
        error.message.includes('Failed to fetch')
      ) {
        throw new DataFileNotFoundError(filePath, error);
      }
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        throw new DataParseError(filePath, error);
      }
    }

    // Generic fallback
    throw new DataParseError(filePath, error);
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
