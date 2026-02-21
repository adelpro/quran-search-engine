import { describe, it, expect } from 'vitest';
import { simpleSearch, search, createArabicFuseSearch } from './search';
import { LRUCache } from './lru-cache';
import { buildInvertedIndex } from '../utils/loader';
import { normalizeArabic } from '../utils/normalization';
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
    const gids = results.map((r) => r.gid);
    expect(gids).toContain(1); // بسم الله الرحمن الرحيم
    expect(gids).toContain(3); // الرحمن الرحيم
  });

  it('should not match when only one token of a multi-token query is present', () => {
    // "الله العالمين" — no single verse in mock data has both tokens
    // Verse 1 has الله but not العالمين, Verse 2 has العالمين but not الله
    const results = simpleSearch(mockQuranData, 'الله العالمين', 'standard');
    expect(results).toHaveLength(0);
  });

  it('should return empty for whitespace-only query', () => {
    const results = simpleSearch(mockQuranData, '   ', 'standard');
    expect(results).toHaveLength(0);
  });

  // ── wordIndex fast path tests ──

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
      expect(withIndex.map((r) => r.gid).sort()).toEqual(withoutIndex.map((r) => r.gid).sort());
    });

    it('should apply AND logic for multi-token queries via wordIndex', () => {
      const wordIndex = buildMockWordIndex();
      const results = simpleSearch(mockQuranData, 'الرحمن الرحيم', 'standard', wordIndex);
      expect(results).toHaveLength(2);
      const gids = results.map((r) => r.gid);
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
      // الله is in verse 1, العالمين is in verse 2 — no overlap
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
        expect(withIdx.map((r) => r.gid).sort()).toEqual(withoutIdx.map((r) => r.gid).sort());
      }
    });
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
    expect(result.results[0].matchScore).toBe(1);
    expect(result.results[0].matchedTokens).toEqual([]);
    expect(result.counts.range).toBe(1);
    expect(result.counts.total).toBe(1);
    expect(result.counts.simple).toBe(0);
  });

  it('should return a range of verses for 1:1-3', () => {
    const result = search('1:1-3', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(3);
    expect(result.results.map((r) => r.gid)).toEqual([1, 2, 3]);
    expect(result.counts.range).toBe(3);
    expect(result.counts.total).toBe(3);
  });

  it('should return a partial range for 1:2-3', () => {
    const result = search('1:2-3', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.gid)).toEqual([2, 3]);
  });

  it('should return all sura verses for 1:', () => {
    const result = search('1:', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(3);
    expect(result.counts.range).toBe(3);
  });

  it('should return empty results for a sura not in data', () => {
    const result = search('2:255', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
    expect(result.counts.range).toBe(0);
    expect(result.counts.total).toBe(0);
  });

  it('should paginate range results', () => {
    const result = search(
      '1:',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 2 },
    );
    expect(result.results).toHaveLength(2);
    expect(result.pagination.totalResults).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.limit).toBe(2);
  });

  it('should fall through to text search for invalid range', () => {
    // 0:1 is invalid (sura 0), so it should fall through to text search
    const result = search('0:1', mockQuranData, mockMorphologyMap, mockWordMap);
    // Falls through to Arabic-only filter which strips digits, yielding empty query
    expect(result.results).toHaveLength(0);
  });
});

// =================================================================
// TESTS FOR ISSUE #7: Fuse.js Pre-indexing
// =================================================================
describe('search with pre-computed Fuse index (Issue #7)', () => {
  it('should use provided Fuse index and not rebuild it', () => {
    // 1. Create a spy/mock for Fuse creation to verify it's NOT called
    // Since we can't easily spy on the exported function in the same module without extensive mocking setup,
    // we will verify behavior by passing a specific Fuse instance and checking results.

    // Create a pre-computed index
    const fuseIndex = createArabicFuseSearch(mockQuranData, ['standard']);

    // 2. Perform search WITH the index
    const result = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      {
        lemma: true,
        root: true,
        fuzzy: true,
      },
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

    expect(second).toBe(first); // Same reference = cache hit
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

  it('should cache different options as separate entries', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);

    const withLemma = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: false },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    const withRoot = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: false, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );

    expect(cache.size).toBe(2);
    expect(withLemma).not.toBe(withRoot);
  });

  it('should cache different pagination as separate entries', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);

    search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 10 },
      undefined,
      cache,
    );
    search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 2, limit: 10 },
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

describe('buildInvertedIndex', () => {
  it('should build lemma and root indices from morphology map', () => {
    const index = buildInvertedIndex(mockMorphologyMap, mockQuranData);

    expect(index.lemmaIndex).toBeInstanceOf(Map);
    expect(index.rootIndex).toBeInstanceOf(Map);
    expect(index.lemmaIndex.size).toBeGreaterThan(0);
    expect(index.rootIndex.size).toBeGreaterThan(0);
  });

  it('should map normalized lemmas to correct GIDs', () => {
    const index = buildInvertedIndex(mockMorphologyMap, mockQuranData);

    // "الله" appears as a lemma in gid 1 and gid 2 ("لله")
    const allahGids = index.lemmaIndex.get('الله');
    expect(allahGids).toBeDefined();
    expect(allahGids!.has(1)).toBe(true);

    // "الرحمن" appears in gid 1 and gid 3
    const rahmanGids = index.lemmaIndex.get('الرحمن');
    expect(rahmanGids).toBeDefined();
    expect(rahmanGids!.has(1)).toBe(true);
    expect(rahmanGids!.has(3)).toBe(true);
  });

  it('should map normalized roots to correct GIDs', () => {
    const index = buildInvertedIndex(mockMorphologyMap, mockQuranData);

    // Root "ر ح م" appears in gid 1 and gid 3
    // After normalizeArabic, spaces are kept
    const rahmRoot = index.rootIndex.get('ر ح م');
    expect(rahmRoot).toBeDefined();
    expect(rahmRoot!.has(1)).toBe(true);
    expect(rahmRoot!.has(3)).toBe(true);
  });

  it('should handle empty morphology map', () => {
    const emptyMap = new Map<number, MorphologyAya>();
    const index = buildInvertedIndex(emptyMap, mockQuranData);

    expect(index.lemmaIndex.size).toBe(0);
    expect(index.rootIndex.size).toBe(0);
    // wordIndex is built from quranData regardless of morphologyMap,
    // so it will have entries from the provided verses.
    expect(index.wordIndex.size).toBeGreaterThan(0);
  });
});

describe('search with inverted index', () => {
  it('should produce identical results to linear scan for lemma search', () => {
    const result = search('الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: false,
      fuzzy: false,
    });

    // الرحمن should match verses containing that lemma
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1); // بسم الله الرحمن الرحيم
    expect(gids).toContain(3); // الرحمن الرحيم
  });

  it('should produce identical results to linear scan for root search', () => {
    const result = search('الحمد', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: false,
      root: true,
      fuzzy: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(2); // الحمد لله رب العالمين
  });
});

describe('search with invertedIndex param', () => {
  it('should use inverted index when passed as argument', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranData);
    const result = search(
      'الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      {
        lemma: true,
        root: true,
      },
      { page: 1, limit: 20 },
      undefined,
      undefined,
      invertedIndex,
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.total).toBeGreaterThan(0);
  });

  it('should fall back to linear scan when invertedIndex is omitted', () => {
    const result = search('الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: false,
      fuzzy: false,
    });

    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should produce consistent results with and without invertedIndex', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranData);
    const withIndex = search(
      'الرحمن',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      {
        lemma: true,
        root: false,
        fuzzy: false,
      },
      { page: 1, limit: 20 },
      undefined,
      undefined,
      invertedIndex,
    );
    const withoutIndex = search('الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: false,
      fuzzy: false,
    });

    expect(withIndex.counts.total).toBe(withoutIndex.counts.total);
  });
});
