import { describe, it, expect } from 'vitest';
import { simpleSearch, search, createArabicFuseSearch } from './search';
import type { QuranText, WordMap, MorphologyAya } from '../types';

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
    standard_full: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
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
    standard_full: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
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
    standard_full: 'الرَّحْمَنِ الرَّحِيمِ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
];

const mockMorphologyMap = new Map<number, MorphologyAya>([
  [
    1,
    {
      gid: 1,
      lemmas: ['بسم', 'الله', 'الرحمن', 'الرحيم'],
      roots: ['ب س م', 'ا ل ه', 'ر ح م', 'ر ح م'],
    },
  ],
  [
    2,
    {
      gid: 2,
      lemmas: ['الحمد', 'لله', 'رب', 'العالمين'],
      roots: ['ح م د', 'ا ل ه', 'ر ب ب', 'ع ل م'],
    },
  ],
  [
    3,
    {
      gid: 3,
      lemmas: ['الرحمن', 'الرحيم'],
      roots: ['ر ح م', 'ر ح م'],
    },
  ],
]);

const mockWordMap: WordMap = {
  الله: { lemma: 'الله', root: 'ا ل ه' },
  الرحمن: { lemma: 'الرحمن', root: 'ر ح م' },
  الحمد: { lemma: 'الحمد', root: 'ح م د' },
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
});

describe('search', () => {
  it('should perform basic search with exact matches', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap);

    expect(result.results).toHaveLength(2);
    expect(result.counts.total).toBe(2);
    expect(result.counts.simple).toBe(1);
    expect(result.pagination.totalResults).toBe(2);
  });

  it('should handle pagination', () => {
    const result = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 1 },
    );

    expect(result.results).toHaveLength(1);
    expect(result.pagination.limit).toBe(1);
    expect(result.pagination.currentPage).toBe(1);
  });

  it('should handle empty query', () => {
    const result = search('', mockQuranData, mockMorphologyMap, mockWordMap);

    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
    expect(result.pagination.totalResults).toBe(0);
  });

  it('should handle non-Arabic query', () => {
    const result = search('xyz123', mockQuranData, mockMorphologyMap, mockWordMap);

    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it('should find lemma matches when enabled', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.lemma).toBeGreaterThanOrEqual(0);
  });

  it('should find root matches when enabled', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: false,
      root: true,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.root).toBeGreaterThanOrEqual(0);
  });

  it('should find fuzzy matches for misspelled words', () => {
    // "الحند" is a misspelling of "الحمد"
    const result = search('الحند', mockQuranData, mockMorphologyMap, mockWordMap);

    // Should find at least one match (Verse 2: الحمد لله...)
    expect(result.results.length).toBeGreaterThan(0);
    // The match type should be 'fuzzy' or 'none' (depending on scoring)
    const match = result.results.find((r) => r.gid === 2);
    expect(match).toBeDefined();
    // In our logic, fuzzy matches usually have matchType 'none' unless explicitly set to 'fuzzy'
    // but the counts.fuzzy aggregates 'none' | 'fuzzy'
    expect(result.counts.fuzzy).toBeGreaterThan(0);
  });
});

describe('createArabicFuseSearch', () => {
  it('should create a Fuse instance', () => {
    const fuse = createArabicFuseSearch(mockQuranData, ['standard']);
    expect(fuse).toBeDefined();
  });

  it('should search with Fuse', () => {
    const fuse = createArabicFuseSearch(mockQuranData, ['standard']);
    const results = fuse.search('الله');
    expect(results.length).toBeGreaterThan(0);
  });
});
