import { normalizeArabic } from '../utils/normalization';
import type { QuranText, MorphologyAya } from '../types';

export const getPositiveTokens = (
  verse: QuranText,
  mode: 'text' | 'lemma' | 'root',
  targetLemma: string | undefined,
  targetRoot: string | undefined,
  cleanQuery: string | undefined,
  morphologyMap: Map<number, MorphologyAya>
): string[] => {
  if (!cleanQuery) return [];

  const normalizedQuery = normalizeArabic(cleanQuery);

  if (mode === 'text') {
    const words = (verse.standard || '')
      .split(/\s+/)
      .map((w) => w.replace(/[^\u0621-\u064A]/g, ''));
    return Array.from(
      new Set(
        words.filter((w) => normalizeArabic(w).includes(normalizedQuery)),
      ),
    );
  }

  const morph = morphologyMap.get(verse.gid);
  if (!morph) return [];

  if (mode === 'lemma' && targetLemma) {
    const normTarget = normalizeArabic(targetLemma);
    return Array.from(
      new Set(
        morph.lemmas.filter((l) => normalizeArabic(l).includes(normTarget)),
      ),
    );
  }

  if (mode === 'root' && targetRoot) {
    const normTarget = normalizeArabic(targetRoot);
    return Array.from(
      new Set(
        morph.roots.filter((r) => normalizeArabic(r).includes(normTarget)),
      ),
    );
  }

  return [];
};
