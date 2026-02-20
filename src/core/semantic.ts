/**
 * This module is responsible for loading the semantic dataset and parsing it
 * Using in-memory Hash Map for O(1) lookup times
 */
import semanticData from '../data/semantic.json';
import { normalizeArabic } from '../utils/normalization';

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
// Build the semantic map once at startup and export it for use in the search engine
export const semanticMap = buildSemanticMap();
