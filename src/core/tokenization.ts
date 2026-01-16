import { normalizeArabic } from '../utils/normalization';
import type { QuranText, MorphologyAya, WordMap } from '../types';

export const getPositiveTokens = (
  verse: QuranText,
  mode: 'text' | 'lemma' | 'root',
  targetLemma: string | undefined,
  targetRoot: string | undefined,
  cleanQuery: string | undefined,
  morphologyMap: Map<number, MorphologyAya>,
  wordMap?: WordMap,
): string[] => {
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
