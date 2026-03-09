import { describe, it, expect } from 'vitest';
import { simpleSearch } from './simple-search';
import { normalizeArabic } from '../../utils/normalization';
import type { QuranText } from '../../types';

// Mock data for testing
const mockQuranData: QuranText[] = [
  {
    gid: 1,
    uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    standard: 'بسم الله الرحمن الرحيم',
    sura_id: 1,
    aya_id: 1,
    aya_id_display: '1',
    page_id: 1,
    juz_id: 1,
    standard_full: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 2,
    uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    standard: 'الحمد لله رب العالمين',
    sura_id: 1,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 1,
    juz_id: 1,
    standard_full: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 3,
    uthmani: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    standard: 'الرحمن الرحيم',
    sura_id: 1,
    aya_id: 3,
    aya_id_display: '3',
    page_id: 1,
    juz_id: 1,
    standard_full: 'الرَّحْمَنِ الرَّحِيمِ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
];

// Build a mock wordIndex from mockQuranData.standard text
const buildMockWordIndex = (): Map<string, Set<number>> => {
  const wordIndex = new Map<string, Set<number>>();
  for (const verse of mockQuranData) {
    const words = normalizeArabic(verse.standard).split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      if (!wordIndex.has(word)) wordIndex.set(word, new Set());
      wordIndex.get(word)!.add(verse.gid);
    }
  }
  return wordIndex;
};

describe('simpleSearch', () => {
  it('should find exact matches', () => {
    const results = simpleSearch(mockQuranData, 'الله', 'standard');
    expect(results).toHaveLength(1);
    expect(results[0].gid).toBe(1);
  });

  it('should handle diacritics in query', () => {
    const results = simpleSearch(mockQuranData, 'ٱللَّهِ', 'standard');
    expect(results).toHaveLength(1);
  });

  it('should return empty array for no matches', () => {
    const results = simpleSearch(mockQuranData, 'xyz', 'standard');
    expect(results).toHaveLength(0);
  });

  it('should handle empty query', () => {
    const results = simpleSearch(mockQuranData, '', 'standard');
    expect(results).toHaveLength(0);
  });

  it('should apply AND logic for multi-token queries', () => {
    const results = simpleSearch(mockQuranData, 'الرحمن الرحيم', 'standard');
    expect(results).toHaveLength(2);
    const gids = results.map((r: QuranText) => r.gid);
    expect(gids).toContain(1); // بسم الله الرحمن الرحيم
    expect(gids).toContain(3); // الرحمن الرحيم
  });

  it('should not match when only one token of a multi-token query is present', () => {
    const results = simpleSearch(mockQuranData, 'الله العالمين', 'standard');
    expect(results).toHaveLength(0);
  });

  it('should return empty for whitespace-only query', () => {
    const results = simpleSearch(mockQuranData, '   ', 'standard');
    expect(results).toHaveLength(0);
  });

  describe('with wordIndex', () => {
    it('should find matches via wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'الله', 'standard', wordIndex);
      expect(results).toHaveLength(1);
      expect(results[0].gid).toBe(1);
    });

    it('should return same results as linear scan for single token', () => {
      const wordIndex = buildMockWordIndex();
      const withIndex = simpleSearch(mockQuranData, 'الرحمن', 'standard', wordIndex);
      const withoutIndex = simpleSearch(mockQuranData, 'الرحمن', 'standard');
      expect(withIndex.map((r: QuranText) => r.gid).sort()).toEqual(
        withoutIndex.map((r: QuranText) => r.gid).sort(),
      );
    });

    it('should apply AND logic for multi-token queries via wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'الرحمن الرحيم', 'standard', wordIndex);
      expect(results).toHaveLength(2);
      const gids = results.map((r: QuranText) => r.gid);
      expect(gids).toContain(1);
      expect(gids).toContain(3);
    });

    it('should return empty when a token is not in wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'كلمةغيرموجودة', 'standard', wordIndex);
      expect(results).toHaveLength(0);
    });

    it('should return empty when multi-token query has no intersection', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'الله العالمين', 'standard', wordIndex);
      expect(results).toHaveLength(0);
    });

    it('should handle diacritics in query with wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'ٱللَّهِ', 'standard', wordIndex);
      expect(results).toHaveLength(1);
      expect(results[0].gid).toBe(1);
    });

    it('should return empty for empty query with wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, '', 'standard', wordIndex);
      expect(results).toHaveLength(0);
    });

    it('should match results between wordIndex and linear scan for all mock queries', () => {
      const wordIndex = buildMockWordIndex();
      const queries = ['الله', 'الرحمن', 'الرحيم', 'الحمد', 'رب', 'بسم'];
      for (const q of queries) {
        const withIdx = simpleSearch(mockQuranData, q, 'standard', wordIndex);
        const withoutIdx = simpleSearch(mockQuranData, q, 'standard');
        expect(withIdx.map((r: QuranText) => r.gid).sort()).toEqual(
          withoutIdx.map((r: QuranText) => r.gid).sort(),
        );
      }
    });
  });
});
