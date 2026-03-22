import semanticData from '../../data/semantic.json';
import { normalizeArabic, isArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse, AdvancedSearchOptions, InvertedIndex } from '../../types';

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
  invertedIndex?: InvertedIndex,
): ScoredVerse<TVerse>[] => {
  if (!options.semantic || !semanticMap) return [];

  const matchedArabicWords = new Set<string>();
  const matchedEnglishWords: string[] = [];
  const directArabicTokens: string[] = [];

  if (query) {
    const normalizedQuery = normalizeArabic(query);
    if (normalizedQuery) {
      matchedArabicWords.add(normalizedQuery);
    }
  }

  if (originalQuery) {
    const tokens = originalQuery.split(/\s+/);
    for (const token of tokens) {
      if (isArabic(token)) {
        const normalizedArabic = normalizeArabic(token);
        if (normalizedArabic) {
          directArabicTokens.push(normalizedArabic);
          matchedArabicWords.add(normalizedArabic);
          const arabicSynonyms = semanticMap.get(normalizedArabic);
          if (arabicSynonyms) {
            arabicSynonyms.forEach((w) => matchedArabicWords.add(w));
          }
        }
        continue;
      }

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

  const semanticIndex = invertedIndex?.semanticIndex;
  const wordIndex = invertedIndex?.wordIndex;
  const results: ScoredVerse<TVerse>[] = [];
  const matchedGids = new Set<number>();

  if (semanticIndex) {
    for (const word of matchedArabicWords) {
      const gids = semanticIndex.get(word);
      if (gids) {
        for (const gid of gids) {
          matchedGids.add(gid);
        }
      }
    }
  } else if (wordIndex) {
    for (const word of matchedArabicWords) {
      const gids = wordIndex.get(word) || wordIndex.get(normalizeArabic(word));
      if (gids) {
        for (const gid of gids) {
          matchedGids.add(gid);
        }
      }
    }
  } else {
    for (const verse of quranData.values()) {
      if (options.suraId && verse.sura_id !== options.suraId) continue;
      if (options.juzId && verse.juz_id !== options.juzId) continue;
      if (options.suraName && verse.sura_name !== options.suraName) continue;

      const normalizedVerse = normalizeArabic(verse.standard);
      const matchedKeywords: string[] = [];

      if (directArabicTokens.length > 0) {
        for (const keyword of directArabicTokens) {
          if (normalizedVerse.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
      }

      if (matchedEnglishWords.length > 0) {
        for (const engWord of matchedEnglishWords) {
          const arabicSynonyms = semanticMap.get(engWord);
          if (arabicSynonyms) {
            for (const synonym of arabicSynonyms) {
              if (normalizedVerse.includes(synonym)) {
                matchedKeywords.push(synonym);
              }
            }
          }
        }
      }

      const arabicSynonymTokens = Array.from(matchedArabicWords).filter(
        (w) => !directArabicTokens.includes(w),
      );
      if (arabicSynonymTokens.length > 0) {
        for (const synonym of arabicSynonymTokens) {
          if (normalizedVerse.includes(synonym)) {
            matchedKeywords.push(synonym);
          }
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
  }

  for (const gid of matchedGids) {
    const verse = quranData.get(gid);
    if (!verse) continue;
    if (options.suraId && verse.sura_id !== options.suraId) continue;
    if (options.juzId && verse.juz_id !== options.juzId) continue;
    if (options.suraName && verse.sura_name !== options.suraName) continue;

    const matchedKeywords = Array.from(matchedArabicWords).filter((word) => {
      const normalizedVerse = normalizeArabic(verse.standard);
      return normalizedVerse.includes(word);
    });

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
