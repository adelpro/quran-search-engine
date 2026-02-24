import { normalizeArabic } from '../utils/normalization';
import { InvalidModeError } from '../errors';
import type { VerseInput, MorphologyAya, WordMap } from '../types';

/**
 * Identifies and returns the specific words from a verse that match the search criteria.
 *
 * Returns empty array if `cleanQuery` is null or empty.
 * * This function supports three matching modes:
 * - 'text': Matches the literal characters of the word.
 * - 'lemma': Matches the word's dictionary/base form.
 * - 'root': Matches the word's Arabic root.
 *
 * @param verse - The verse object containing the text to be scanned
 * @param mode - the search mode
 * @param targetLemma - The base form to look for (required for lemma mode)
 * @param targetRoot - The Arabic root to look for (required for root mode).
 * @param cleanQuery - the normalized query string from the user
 * @param morphologyMap - A map of verse IDs to their morphological data.
 * @param wordMap - (Optional) A map for looking up lemmas and roots of specific words.
 * @returns An array of unique matching words or tokens found in the verse.
 *
 * @example
 * getPositiveTokens(verse, 'text', undefined, undefined, 'الله', MorphMap)
 * // Returns ["لله", "الله"]
 */
export const getPositiveTokens = (
  verse: VerseInput,
  mode: 'text' | 'lemma' | 'root',
  targetLemma: string | undefined,
  targetRoot: string | undefined,
  cleanQuery: string | undefined,
  morphologyMap: Map<number, MorphologyAya>,
  wordMap?: WordMap,
): string[] => {
  // Validate mode parameter
  const validModes = ['text', 'lemma', 'root'];
  if (!validModes.includes(mode)) {
    throw new InvalidModeError(mode);
  }

  if (!cleanQuery) return [];

  const normalizedQuery = normalizeArabic(cleanQuery);
  if (!normalizedQuery) return [];

  if (mode === 'text') {
    const words = (verse.standard || '')
      .split(/\s+/)
      .map((w) => w.replace(/[^\u0621-\u064A]/g, ''));
    return Array.from(new Set(words.filter((w) => normalizeArabic(w).includes(normalizedQuery))));
  }

  // New Logic: Scan verse words using wordMap to find exact words to highlight
  if (wordMap && (mode === 'lemma' || mode === 'root')) {
    const words = (verse.standard || '').split(/\s+/);
    const matchedWords: string[] = [];

    for (const word of words) {
      const cleanWord = word.replace(/[^\u0621-\u064A]/g, '');
      const normalizedWord = normalizeArabic(cleanWord);
      const entry = wordMap[normalizedWord];

      if (entry) {
        if (mode === 'lemma' && targetLemma && entry.lemma) {
          if (normalizeArabic(entry.lemma).includes(normalizeArabic(targetLemma))) {
            matchedWords.push(word);
          }
        }
        if (mode === 'root' && targetRoot && entry.root) {
          if (normalizeArabic(entry.root).includes(normalizeArabic(targetRoot))) {
            matchedWords.push(word);
          }
        }
      }
    }

    if (matchedWords.length > 0) {
      return Array.from(new Set(matchedWords));
    }
  }

  // Fallback to MorphologyMap (Old behavior: returns the lemma/root string itself, not the verse word)
  const morph = morphologyMap.get(verse.gid);
  if (!morph) return [];

  if (mode === 'lemma' && targetLemma) {
    const normTarget = normalizeArabic(targetLemma);
    return Array.from(new Set(morph.lemmas.filter((l) => normalizeArabic(l).includes(normTarget))));
  }

  if (mode === 'root' && targetRoot) {
    const normTarget = normalizeArabic(targetRoot);
    return Array.from(new Set(morph.roots.filter((r) => normalizeArabic(r).includes(normTarget))));
  }

  return [];
};
