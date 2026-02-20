import { describe, it, expect } from 'vitest';
import { search } from './search';
import type { QuranText, WordMap, MorphologyAya } from '../types';

// Mock data for testing semantic search
const mockQuranData: QuranText[] = [
  {
    gid: 1,
    uthmani: 'إِنَّ ٱلۡإِنسَٰنَ لَفِي خُسۡرٍ',
    standard: 'ان الانسان لفي خسر',
    sura_id: 103,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 601,
    juz_id: 30,
    standard_full: 'إِنَّ الْإِنْسَانَ لَفِي خُسْرٍ',
    sura_name: 'العصر',
    sura_name_en: 'The Declining Day',
    sura_name_romanization: 'Al-Asr',
  },
  {
    gid: 2,
    uthmani: 'كَلَّآ إِنَّ ٱلۡبَشَرَ لَيَطۡغَىٰ', // Note: Modified slightly for test (human/bashar concept)
    standard: 'كلا ان البشر ليطغى',
    sura_id: 96,
    aya_id: 6,
    aya_id_display: '6',
    page_id: 597,
    juz_id: 30,
    standard_full: 'كَلَّا إِنَّ الْبَشَرَ لَيَطْغَى',
    sura_name: 'العلق',
    sura_name_en: 'The Clot',
    sura_name_romanization: 'Al-Alaq',
  },
];

const mockMorphologyMap = new Map<number, MorphologyAya>();
const mockWordMap: WordMap = {};

describe('Semantic Search Verification', () => {
  it('should find verses by semantic Arabic synonyms', () => {
    // In semantic.json, "إنسان" and "بشر" are both under "Human"
    const result = search('إنسان', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      semantic: true,
    });

    // Should find gid 1 (exact/simple matches might find it too)
    // AND gid 2 (via semantic synonym "بشر")
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(result.counts.semantic).toBeGreaterThan(0);
  });

  it('should FAIL for English queries due to regex stripping (as identified in plan)', () => {
    // Currently search.ts has: const arabicOnly = query.replace(/[^\u0621-\u064A\s]/g, '').trim();
    // This will strip "Human" to ""
    const result = search('Human', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      semantic: true,
    });

    expect(result.results).toHaveLength(0);
  });
});
