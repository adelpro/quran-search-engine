import { describe, it, expect } from 'vitest';
import { search } from '../search';
import type { QuranText, MorphologyAya, ScoredVerse } from '../../types';

// Mock data for testing semantic search
const mockQuranData: QuranText[] = [
  {
    gid: 1,
    uthmani: 'إِنَّ ٱلۡإِنسَٰنَ لَفِي خُسۡرٍ',
    standard: 'ان الانسان لفي خسر',
    sura_id: 103,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 601,
    juz_id: 30,
    standard_full: 'إِنَّ الْإِنْسَانَ لَفِي خُسْرٍ',
    sura_name: 'العصر',
    sura_name_en: 'The Declining Day',
    sura_name_romanization: 'Al-Asr',
  },
  {
    gid: 2,
    uthmani: 'كَلَّآ إِنَّ ٱلۡبَشَرَ لَيَطۡغَىٰ',
    standard: 'كلا ان البشر ليطغى',
    sura_id: 96,
    aya_id: 6,
    aya_id_display: '6',
    page_id: 597,
    juz_id: 30,
    standard_full: 'كَلَّا إِنَّ الْبَشَرَ لَيَطْغَى',
    sura_name: 'العلق',
    sura_name_en: 'The Clot',
    sura_name_romanization: 'Al-Alaq',
  },
];

const mockQuranDataMap = new Map((mockQuranData as QuranText[]).map((v) => [v.gid, v]));
const mockMorphologyMap = new Map<number, MorphologyAya>();
const mockWordMapMap = new Map<string, { lemma?: string; root?: string }>();

// إنسان normalizes to انسان (tashkeel removed, hamza normalized)
// بشر normalizes to بشر — both words appear in their respective verses
const mockSemanticMap = new Map<string, string[]>([
  ['انسان', ['انسان', 'بشر']],
  ['بشر', ['انسان', 'بشر']],
]);

describe('Semantic Search Verification', () => {
  it('should find verses by semantic Arabic synonyms', () => {
    // In semantic map, "إنسان" and "بشر" are both under the same concept.
    // Gid 1 has "الانسان" (direct match), gid 2 has "البشر" (semantic synonym match)
    const result = search(
      'إنسان',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
        semanticMap: mockSemanticMap,
      },
      {
        lemma: true,
        root: true,
        semantic: true,
      },
    );

    // Should find gid 1 (exact/simple matches might find it too)
    // AND gid 2 (via semantic synonym "بشر")
    const gids = result.results.map((r: ScoredVerse<QuranText>) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(result.counts.semantic).toBeGreaterThan(0);
  });

  it('should FAIL for English queries due to regex stripping (as identified in plan)', () => {
    // search.ts strips non-Arabic: query.replace(/[^\u0621-\u064A\s]/g, '').trim()
    // This will strip "Human" to "" → empty result
    const result = search(
      'Human',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
        semanticMap: mockSemanticMap,
      },
      {
        lemma: true,
        root: true,
        semantic: true,
      },
    );

    expect(result.results).toHaveLength(0);
  });
});
