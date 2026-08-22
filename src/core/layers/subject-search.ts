import { normalizeArabic, isArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse, AdvancedSearchOptions, InvertedIndex } from '../../types';

export const performSubjectSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: Map<number, TVerse>,
  options: AdvancedSearchOptions,
  subjectMap?: Map<string, string[]>,
  originalQuery?: string,
  invertedIndex?: InvertedIndex,
): ScoredVerse<TVerse>[] => {
  if (!options.subject || !subjectMap) return [];

  const matchedArabicWords = new Set<string>();
  const matchedSubjects: string[] = [];

  const tokens = (originalQuery || query).split(/\s+/);

  for (const token of tokens) {
    if (isArabic(token)) {
      const normalized = normalizeArabic(token);
      if (normalized) {
        // Check if this Arabic word is a key in the subject map (subject name in Arabic)
        const subjectWords = subjectMap.get(normalized);
        if (subjectWords) {
          subjectWords.forEach((w) => matchedArabicWords.add(w));
          matchedSubjects.push(normalized);
        } else {
          // Otherwise treat it as a direct Arabic search term
          matchedArabicWords.add(normalized);
        }
      }
      continue;
    }

    const cleanToken = token
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim();
    if (!cleanToken) continue;

    const subjectWords = subjectMap.get(cleanToken);
    if (subjectWords) {
      subjectWords.forEach((w) => matchedArabicWords.add(w));
      matchedSubjects.push(cleanToken);
    }
  }

  if (matchedArabicWords.size === 0) return [];

  const subjectIndex = invertedIndex?.subjectIndex;
  const wordIndex = invertedIndex?.wordIndex;
  const results: ScoredVerse<TVerse>[] = [];

  // Fast path: use pre-built subjectIndex
  if (subjectIndex) {
    const matchedGids = new Set<number>();

    for (const subject of matchedSubjects) {
      const gids = subjectIndex.get(subject);
      if (gids) {
        for (const gid of gids) matchedGids.add(gid);
      }
    }

    // Also look up individual Arabic words that weren't resolved via a subject key
    for (const word of matchedArabicWords) {
      const gids = wordIndex?.get(word);
      if (gids) {
        for (const gid of gids) matchedGids.add(gid);
      }
    }

    for (const gid of matchedGids) {
      const verse = quranData.get(gid);
      if (!verse) continue;
      if (options.suraId && verse.sura_id !== options.suraId) continue;
      if (options.juzId && verse.juz_id !== options.juzId) continue;
      if (options.suraName && verse.sura_name !== options.suraName) continue;

      const normalizedVerse = normalizeArabic(verse.standard);
      const matchedKeywords = Array.from(matchedArabicWords).filter((w) =>
        normalizedVerse.includes(w),
      );

      if (matchedKeywords.length > 0) {
        results.push({
          ...verse,
          matchType: 'subject',
          matchScore: matchedKeywords.length * 4,
          matchedTokens: matchedKeywords,
        });
      }
    }

    return results;
  }

  // Slow path: iterate all verses
  for (const verse of quranData.values()) {
    if (options.suraId && verse.sura_id !== options.suraId) continue;
    if (options.juzId && verse.juz_id !== options.juzId) continue;
    if (options.suraName && verse.sura_name !== options.suraName) continue;

    const normalizedVerse = normalizeArabic(verse.standard);
    const matchedKeywords = Array.from(matchedArabicWords).filter((w) =>
      normalizedVerse.includes(w),
    );

    if (matchedKeywords.length > 0) {
      results.push({
        ...verse,
        matchType: 'subject',
        matchScore: matchedKeywords.length * 4,
        matchedTokens: matchedKeywords,
      });
    }
  }

  return results;
};
