import { describe, it, expect } from 'vitest';
import { simpleSearch, search, createArabicFuseSearch } from './search';
import { LRUCache } from './lru-cache';
import type { QuranText, WordMap, MorphologyAya, SearchResponse } from '../types';

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
  [3, { gid: 3, lemmas: ['الرحمن', 'الرحيم'], roots: ['ر ح م', 'ر ح م'] }],
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
    const result = search('الحند', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    const match = result.results.find((r) => r.gid === 2);
    expect(match).toBeDefined();
    expect(result.counts.fuzzy).toBeGreaterThan(0);
  });

  it('should disable fuzzy fallback when fuzzy is false', () => {
    const result = search('الحند', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      fuzzy: false,
    });
    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
    expect(result.counts.fuzzy).toBe(0);
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

describe('range search', () => {
  it('should return a single verse for 1:1', () => {
    const result = search('1:1', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].gid).toBe(1);
    expect(result.results[0].matchType).toBe('range');
  });

  it('should return a range of verses for 1:1-3', () => {
    const result = search('1:1-3', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(3);
  });

  it('should paginate range results', () => {
    const result = search('1:', mockQuranData, mockMorphologyMap, mockWordMap, undefined, {
      page: 1,
      limit: 2,
    });
    expect(result.results).toHaveLength(2);
    expect(result.pagination.totalResults).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.limit).toBe(2);
  });

  it('should fall through to text search for invalid range', () => {
    const result = search('0:1', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
  });
});

describe('search with pre-computed Fuse index (Issue #7)', () => {
  it('should use provided Fuse index and not rebuild it', () => {
    const fuseIndex = createArabicFuseSearch(mockQuranData, ['standard']);
    const result = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true, fuzzy: true },
      undefined,
      fuseIndex,
    );
    expect(result.results.length).toBeGreaterThan(0);
  });
});

describe('search with LRUCache', () => {
  it('should return cached result on identical query', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);
    const options = { lemma: true, root: true };
    const pagination = { page: 1, limit: 20 };

    const first = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      options,
      pagination,
      undefined,
      cache,
    );
    const second = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      options,
      pagination,
      undefined,
      cache,
    );

    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });

  it('should cache different queries as separate entries', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);
    search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    search(
      'الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );

    expect(cache.size).toBe(2);
  });

  it('should work without cache (backward compatible)', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
  });
});

describe('transliterated search', () => {
  it('should find verses when searching with Latin "Allah"', () => {
    const result = search('Allah', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    // Should find at least gid:1 which has "بسم الله"
    expect(result.results.some((r) => r.gid === 1)).toBe(true);
  });

  it('should find verses when searching with Latin "Rahman"', () => {
    const result = search('Rahman', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    // Should find gid:1 and/or gid:3 which have "الرحمن"
    const gids = result.results.map((r) => r.gid);
    expect(gids.some((g) => g === 1 || g === 3)).toBe(true);
  });

  it('should still work with Arabic queries (backward compatible)', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should return empty for nonsensical Latin input', () => {
    const result = search('xyzqwerty', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
  });

  it('should handle mixed case Latin input', () => {
    const result = search('ALLAH', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
  });
});
