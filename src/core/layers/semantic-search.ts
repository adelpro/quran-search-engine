/**
 * This module is responsible for loading the semantic dataset and parsing it
 * Using in-memory Hash Map for O(1) lookup times
 */
import semanticData from '../../data/semantic.json';
import { normalizeArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse, AdvancedSearchOptions } from '../../types';

interface SemanticConcept {
  english: string[];
  arabic: string[];
  category?: string;
  notes?: string;
}

// loading and building the semantic map at startup
export const buildSemanticMap = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const data = semanticData as SemanticConcept[];

  for (const concept of data) {
    // For each Arabic word in the concept, we map it to the full list of Arabic words in that concept
    for (const word of concept.arabic) {
      // Normalize the Arabic words using the shared utility
      const cleanWord = normalizeArabic(word);
      if (cleanWord) {
        map.set(cleanWord, concept.arabic);
      }
    }

    // support English words as well for semantic search
    for (const engWord of concept.english) {
      // Normalize the English words by removing any non-english characters and trimming whitespace
      const cleanWord = engWord.replace(/[^a-zA-Z\s]/g, '').trim();
      map.set(cleanWord.toLowerCase(), concept.arabic);
    }
  }

  return map;
};
export const semanticMap = buildSemanticMap();

/**
 * Searches the semantic mapping for the query to identify related synonyms.
 */
export const performSemanticSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: TVerse[],
  options: AdvancedSearchOptions,
): ScoredVerse<TVerse>[] => {
  if (!options.semantic) return [];

  const semanticMatches = semanticMap.get(query);
  if (!semanticMatches) return [];

  const results: ScoredVerse<TVerse>[] = [];

  for (const verse of quranData) {
    if (options.suraId && verse.sura_id !== options.suraId) continue;
    if (options.juzId && verse.juz_id !== options.juzId) continue;
    if (options.suraName && verse.sura_name !== options.suraName) continue;

    const normalizedVerse = normalizeArabic(verse.standard);
    const matchedKeywords: string[] = [];

    for (const keyword of semanticMatches) {
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
