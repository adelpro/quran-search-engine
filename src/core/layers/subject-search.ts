import { normalizeArabic, isArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse, AdvancedSearchOptions, InvertedIndex } from '../../types';

/** Resolve a raw query string to matched Arabic words and subject keys. */
const resolveQuery = (
  rawQuery: string,
  subjectMap: Map<string, string[]>,
): { matchedArabicWords: Set<string>; matchedSubjects: string[] } => {
  const matchedArabicWords = new Set<string>();
  const matchedSubjects: string[] = [];

  // Try the full query as a phrase key first — resolves multi-word aliases
  // like "eternal life", "judgment day", "blazing fire".
  const fullPhrase = rawQuery.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (fullPhrase && subjectMap.has(fullPhrase)) {
    subjectMap.get(fullPhrase)!.forEach((w) => matchedArabicWords.add(w));
    matchedSubjects.push(fullPhrase);
  }

  for (const token of rawQuery.split(/\s+/)) {
    if (isArabic(token)) {
      const normalized = normalizeArabic(token);
      if (!normalized) continue;
      const subjectWords = subjectMap.get(normalized);
      if (subjectWords) {
        subjectWords.forEach((w) => matchedArabicWords.add(w));
        matchedSubjects.push(normalized);
      } else {
        matchedArabicWords.add(normalized);
      }
      continue;
    }

    const cleanToken = token.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!cleanToken) continue;
    const subjectWords = subjectMap.get(cleanToken);
    if (subjectWords) {
      subjectWords.forEach((w) => matchedArabicWords.add(w));
      matchedSubjects.push(cleanToken);
    }
  }

  return { matchedArabicWords, matchedSubjects };
};

/** Score a single verse against the matched Arabic words, respecting range filters. */
const scoreVerse = <TVerse extends VerseInput>(
  verse: TVerse,
  options: AdvancedSearchOptions,
  matchedArabicWords: Set<string>,
): ScoredVerse<TVerse> | null => {
  if (options.suraId && verse.sura_id !== options.suraId) return null;
  if (options.juzId && verse.juz_id !== options.juzId) return null;
  if (options.suraName && verse.sura_name !== options.suraName) return null;

  const normalizedVerse = normalizeArabic(verse.standard);
  const matchedKeywords = Array.from(matchedArabicWords).filter((w) =>
    normalizedVerse.includes(w),
  );

  if (matchedKeywords.length === 0) return null;

  return {
    ...verse,
    matchType: 'subject',
    matchScore: matchedKeywords.length * 4,
    matchedTokens: matchedKeywords,
  };
};

export const performSubjectSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: Map<number, TVerse>,
  options: AdvancedSearchOptions,
  subjectMap?: Map<string, string[]>,
  originalQuery?: string,
  invertedIndex?: InvertedIndex,
): ScoredVerse<TVerse>[] => {
  if (!options.subject || !subjectMap) return [];

  const { matchedArabicWords, matchedSubjects } = resolveQuery(
    (originalQuery || query).trim(),
    subjectMap,
  );

  if (matchedArabicWords.size === 0) return [];

  const subjectIndex = invertedIndex?.subjectIndex;
  const wordIndex = invertedIndex?.wordIndex;
  const results: ScoredVerse<TVerse>[] = [];

  // Fast path: collect candidate GIDs from the pre-built index
  if (subjectIndex) {
    const matchedGids = new Set<number>();

    for (const subject of matchedSubjects) {
      subjectIndex.get(subject)?.forEach((gid) => matchedGids.add(gid));
    }

    // Also cover Arabic words entered directly (not resolved via a subject key)
    for (const word of matchedArabicWords) {
      wordIndex?.get(word)?.forEach((gid) => matchedGids.add(gid));
    }

    for (const gid of matchedGids) {
      const verse = quranData.get(gid);
      if (!verse) continue;
      const scored = scoreVerse(verse, options, matchedArabicWords);
      if (scored) results.push(scored);
    }

    return results;
  }

  // Slow path: scan all verses
  for (const verse of quranData.values()) {
    const scored = scoreVerse(verse, options, matchedArabicWords);
    if (scored) results.push(scored);
  }

  return results;
};
