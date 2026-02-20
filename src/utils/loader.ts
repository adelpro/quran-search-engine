import type { MorphologyAya, WordMap, QuranText } from '../types';

/**
 * Lazily loads the Quran morphology data.
 * This large dataset is loaded asynchronously to avoid increasing the initial bundle size.
 *
 * @returns A Promise that resolves to a Map where the key is the verse GID and value is morphology data.
 */
export const loadMorphology = async (path?: string): Promise<Map<number, MorphologyAya>> => {
  try {
    // Dynamic import for code splitting
    const morphologyModule = await import(path || '../data/morphology.json');

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
export const loadWordMap = async (path?: string): Promise<WordMap> => {
  try {
    const wordMapModule = await import(path || '../data/word-map.json');
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
export const loadQuranData = async (path?: string): Promise<QuranText[]> => {
  try {
    const quranModule = await import(path || '../data/quran.json');
    return (quranModule.default || quranModule) as QuranText[];
  } catch (error) {
    console.error('Failed to load Quran data:', error);
    throw new Error('Could not load Quran data. Ensure src/data/quran.json exists.');
  }
};
