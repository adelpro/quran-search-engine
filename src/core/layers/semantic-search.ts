import semanticData from '../../data/semantic.json';
import { normalizeArabic, isArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse, AdvancedSearchOptions } from '../../types';

interface SemanticConcept {
  english: string[];
  arabic: string[];
}

export const buildSemanticMap = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const data = semanticData as SemanticConcept[];

  for (const concept of data) {
    for (const word of concept.arabic) {
      const cleanWord = normalizeArabic(word);
      if (cleanWord) {
        map.set(cleanWord, concept.arabic);
      }
    }

    for (const engWord of concept.english) {
      const cleanWord = engWord.replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanWord) {
        map.set(cleanWord.toLowerCase(), concept.arabic);
      }
    }
  }

  return map;
};

export const semanticMap = buildSemanticMap();

export const performSemanticSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: Map<number, TVerse>,
  options: AdvancedSearchOptions,
  semanticMap?: Map<string, string[]>,
  originalQuery?: string,
): ScoredVerse<TVerse>[] => {
  if (!options.semantic || !semanticMap) return [];

  const matchedArabicWords = new Set<string>();
  const matchedEnglishWords: string[] = [];

  const arabicMatches = semanticMap.get(query);
  if (arabicMatches) {
    arabicMatches.forEach((w) => matchedArabicWords.add(w));
  }

  if (originalQuery) {
    const tokens = originalQuery.split(/\s+/);
    for (const token of tokens) {
      if (isArabic(token)) continue;
      const cleanToken = token
        .toLowerCase()
        .trim()
        .replace(/[^a-zA-Z]/g, '');
      const englishMatches = semanticMap.get(cleanToken);
      if (englishMatches) {
        englishMatches.forEach((w) => matchedArabicWords.add(w));
        matchedEnglishWords.push(cleanToken);
      }
    }
  }

  if (matchedArabicWords.size === 0) return [];

  const results: ScoredVerse<TVerse>[] = [];
  const arabicWordsArray = Array.from(matchedArabicWords);

  for (const verse of quranData.values()) {
    if (options.suraId && verse.sura_id !== options.suraId) continue;
    if (options.juzId && verse.juz_id !== options.juzId) continue;
    if (options.suraName && verse.sura_name !== options.suraName) continue;

    const normalizedVerse = normalizeArabic(verse.standard);
    const matchedKeywords: string[] = [];

    for (const keyword of arabicWordsArray) {
      if (normalizedVerse.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      results.push({
        ...verse,
        matchType: 'semantic',
        matchScore: matchedKeywords.length * 5,
        matchedTokens: matchedKeywords,
      });
    }
  }

  return results;
};
