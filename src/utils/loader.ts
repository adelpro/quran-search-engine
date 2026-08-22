import type { MorphologyAya, WordMap, QuranText, InvertedIndex, SubjectIndex } from '../types';
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
export const loadMorphology = async (): Promise<Map<number, MorphologyAya>> => {
  const filePath = '../data/morphology.json';

  try {
    // Dynamic import for code splitting
    // We use a static string for the default path so Vite can analyze it.
    // If a custom path is provided, we use it directly but Vite might warn.
    const morphologyModule = await import('../data/morphology.json');

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
export const loadWordMap = async (): Promise<WordMap> => {
  const filePath = '../data/word-map.json';

  try {
    const wordMapModule = await import('../data/word-map.json');
    const wordMapRaw = (wordMapModule.default || wordMapModule) as Record<
      string,
      { lemma?: string; root?: string }
    >;

    // Validate schema
    if (!wordMapRaw || typeof wordMapRaw !== 'object') {
      throw new DataSchemaInvalidError(filePath, 'Expected an object for word map data');
    }

    if (Object.keys(wordMapRaw).length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Word map data is empty');
    }

    const wordMap = new Map<string, { lemma?: string; root?: string }>();
    for (const [key, val] of Object.entries(wordMapRaw)) {
      wordMap.set(key, val);
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
export const loadQuranData = async (): Promise<Map<number, QuranText>> => {
  const filePath = '../data/quran.json';

  try {
    const quranModule = await import('../data/quran.json');
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

    const quranMap = new Map<number, QuranText>();
    for (const verse of quranData) {
      quranMap.set(verse.gid, verse);
    }

    return quranMap;
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
  quranData: Map<number, QuranText>,
  semanticMap?: Map<string, string[]>,
  subjectMap?: Map<string, string[]>,
): InvertedIndex => {
  const lemmaIndex = new Map<string, Set<number>>();
  const rootIndex = new Map<string, Set<number>>();
  const wordIndex = new Map<string, Set<number>>();
  const semanticIndex = semanticMap ? new Map<string, Set<number>>() : undefined;
  const subjectIndex: SubjectIndex | undefined = subjectMap
    ? new Map<string, Set<number>>()
    : undefined;

  for (const morph of morphologyMap.values()) {
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
  for (const verse of quranData.values()) {
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

  // Build semanticIndex based on the computed wordIndex
  if (semanticMap && semanticIndex) {
    for (const [key, words] of semanticMap.entries()) {
      const gids = new Set<number>();
      for (const word of words) {
        const matches = wordIndex.get(word) || wordIndex.get(normalizeArabic(word));
        if (matches) {
          for (const gid of matches) {
            gids.add(gid);
          }
        }
      }
      if (gids.size > 0) {
        semanticIndex.set(key, gids);
      }
    }
  }

  // Build subjectIndex: each subject key → union of GIDs for all its Arabic words
  if (subjectMap && subjectIndex) {
    for (const [key, words] of subjectMap.entries()) {
      const gids = new Set<number>();
      for (const word of words) {
        const normalized = normalizeArabic(word);
        const matches = wordIndex.get(normalized) || wordIndex.get(word);
        if (matches) {
          for (const gid of matches) {
            gids.add(gid);
          }
        }
      }
      if (gids.size > 0) {
        subjectIndex.set(key, gids);
      }
    }
  }

  return { lemmaIndex, rootIndex, wordIndex, semanticIndex, subjectIndex };
};

export const loadSemanticData = async (): Promise<Map<string, string[]>> => {
  const filePath = '../data/semantic.json';

  try {
    const semanticModule = await import('../data/semantic.json');
    const semanticData = (semanticModule.default || semanticModule) as SemanticConcept[];

    if (!Array.isArray(semanticData)) {
      throw new DataSchemaInvalidError(filePath, 'Expected an array of semantic data');
    }

    if (semanticData.length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Semantic data is empty');
    }

    return buildSemanticMap(semanticData);
  } catch (error) {
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

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

    throw new DataParseError(filePath, error);
  }
};

interface SemanticConcept {
  english: string[];
  arabic: string[];
  category?: string;
  notes?: string;
}

const buildSemanticMap = (semanticData: SemanticConcept[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const concept of semanticData) {
    for (const word of concept.arabic) {
      const cleanWord = normalizeArabic(word);
      if (cleanWord) {
        map.set(cleanWord, concept.arabic);
      }
    }
    for (const engWord of concept.english) {
      const cleanWord = engWord.replace(/[^a-zA-Z\s]/g, '').trim();
      map.set(cleanWord.toLowerCase(), concept.arabic);
    }
  }
  return map;
};

type PhoneticDictionary = Record<string, string[]>;

export const loadPhoneticData = async (): Promise<Map<string, string[]>> => {
  const filePath = '../data/phonetic.json';

  try {
    const phoneticModule = await import('../data/phonetic.json');
    const phoneticData = (phoneticModule.default || phoneticModule) as PhoneticDictionary;

    if (!phoneticData || typeof phoneticData !== 'object') {
      throw new DataSchemaInvalidError(filePath, 'Expected an object for phonetic data');
    }

    if (Object.keys(phoneticData).length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Phonetic data is empty');
    }

    const map = new Map<string, string[]>();
    for (const [phonetic, arabicWords] of Object.entries(phoneticData)) {
      const cleanLatinWord = phonetic.toLowerCase().trim();
      map.set(cleanLatinWord, arabicWords);
    }

    return map;
  } catch (error) {
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

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

    throw new DataParseError(filePath, error);
  }
};

interface SubjectConcept {
  subject: string;
  english: string[];
  arabic: string[];
}

const buildSubjectMap = (subjectData: SubjectConcept[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const concept of subjectData) {
    const normalizedArabic = concept.arabic.map((w) => normalizeArabic(w)).filter(Boolean);
    map.set(concept.subject.toLowerCase(), normalizedArabic);
    for (const engWord of concept.english) {
      const cleanWord = engWord
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim();
      if (cleanWord) {
        map.set(cleanWord, normalizedArabic);
      }
    }
  }
  return map;
};

export const loadSubjectData = async (): Promise<Map<string, string[]>> => {
  const filePath = '../data/subjects.json';

  try {
    const subjectModule = await import('../data/subjects.json');
    const subjectData = (subjectModule.default || subjectModule) as SubjectConcept[];

    if (!Array.isArray(subjectData)) {
      throw new DataSchemaInvalidError(filePath, 'Expected an array of subject data');
    }

    if (subjectData.length === 0) {
      throw new DataSchemaInvalidError(filePath, 'Subject data is empty');
    }

    return buildSubjectMap(subjectData);
  } catch (error) {
    if (
      error instanceof DataFileNotFoundError ||
      error instanceof DataParseError ||
      error instanceof DataSchemaInvalidError
    ) {
      throw error;
    }

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

    throw new DataParseError(filePath, error);
  }
};
