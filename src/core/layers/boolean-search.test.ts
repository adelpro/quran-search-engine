import { describe, it, expect } from 'vitest';
import { booleanSearch } from './boolean-search';
import { LRUCache } from '../../utils/lru-cache';
import { buildInvertedIndex } from '../../utils/loader';
import type { QuranText, WordMap, MorphologyAya, SearchResponse } from '../../types';

// Mock data for testing (same as search.test.ts)
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
  الرحيم: { lemma: 'الرحيم', root: 'ر ح م' },
  بسم: { lemma: 'بسم', root: 'ب س م' },
  رب: { lemma: 'رب', root: 'ر ب ب' },
  العالمين: { lemma: 'العالمين', root: 'ع ل م' },
};

describe('booleanSearch - MUST operator (+)', () => {
  it('should find verses that MUST contain a term: +الله', () => {
    // الله appears in verse 1 (بسم الله...) and verse 2 (الحمد لله...)
    const result = booleanSearch('+الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(gids).not.toContain(3); // Verse 3 doesn't have الله
  });

  it('should find verses with multiple MUST terms: +الله +الرحمن', () => {
    // Both الله AND الرحمن appear together only in verse 1
    const result = booleanSearch('+الله +الرحمن', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2); // Verse 2 has الله but not الرحمن
    expect(gids).not.toContain(3); // Verse 3 has الرحمن but not الله
  });

  it('should return empty when MUST term does not exist', () => {
    const result = booleanSearch('+كلمةغيرموجودة', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it('should handle MUST with three terms: +الرحمن +الرحيم +بسم', () => {
    // All three appear together only in verse 1
    const result = booleanSearch(
      '+الرحمن +الرحيم +بسم',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(1);
  });
});

describe('booleanSearch - EXCLUDE operator (-)', () => {
  it('should exclude verses containing a term: -الله', () => {
    // Exclude verses with الله → only verse 3 remains
    const result = booleanSearch('-الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(3);
    expect(gids).not.toContain(1);
    expect(gids).not.toContain(2);
  });

  it('should exclude verses containing a term: -العالمين', () => {
    // العالمين only in verse 2, so verses 1 and 3 remain
    const result = booleanSearch('-العالمين', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
    expect(gids).not.toContain(2);
  });

  it('should handle multiple EXCLUDE terms: -الله -العالمين', () => {
    // Exclude verses with الله OR العالمين → only verse 3 remains
    const result = booleanSearch('-الله -العالمين', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(3);
  });

  it('should return all verses when excluding non-existent term', () => {
    const result = booleanSearch('-كلمةغيرموجودة', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(3);
  });
});

describe('booleanSearch - EITHER operator (|)', () => {
  it('should find verses with either term: الرحمن | الحمد', () => {
    // الرحمن in verses 1, 3; الحمد in verse 2 → all three verses match
    const result = booleanSearch('الرحمن | الحمد', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(3);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(gids).toContain(3);
  });

  it('should find verses with either term: بسم | العالمين', () => {
    // بسم in verse 1; العالمين in verse 2
    const result = booleanSearch('بسم | العالمين', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(gids).not.toContain(3);
  });

  it('should handle OR with non-existent term: الله | كلمةغيرموجودة', () => {
    // الله exists, so should return verses 1 and 2
    const result = booleanSearch(
      'الله | كلمةغيرموجودة',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
  });

  it('should return empty when no OR terms exist', () => {
    const result = booleanSearch('كلمة1 | كلمة2', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
  });
});

describe('booleanSearch - Combined operators', () => {
  it('should combine MUST and EXCLUDE: +الله -الرحمن', () => {
    // الله is in verses 1, 2; الرحمن is in verses 1, 3
    // So: has الله but NOT الرحمن → only verse 2
    const result = booleanSearch('+الله -الرحمن', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(2);
  });

  it('should combine MUST and OR: +الله الرحمن | العالمين', () => {
    // Must have الله AND (الرحمن OR العالمين)
    // Verse 1: has الله and الرحمن ✓
    // Verse 2: has الله and العالمين ✓
    const result = booleanSearch(
      '+الله الرحمن | العالمين',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
  });

  it('should combine OR and EXCLUDE: الرحمن | الحمد -العالمين', () => {
    // (الرحمن OR الحمد) AND NOT العالمين
    // Verse 1: has الرحمن, no العالمين ✓
    // Verse 2: has الحمد, has العالمين ✗
    // Verse 3: has الرحمن, no العالمين ✓
    const result = booleanSearch(
      'الرحمن | الحمد -العالمين',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
    expect(gids).not.toContain(2);
  });

  it('should combine all operators: +الرحمن الرحيم | بسم -الحمد', () => {
    // Must have الرحمن AND (الرحيم OR بسم) AND NOT الحمد
    // Verse 1: has الرحمن, has both الرحيم and بسم, no الحمد ✓
    // Verse 3: has الرحمن, has الرحيم, no الحمد ✓
    const result = booleanSearch(
      '+الرحمن الرحيم | بسم -الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
  });

  it('should handle complex query with multiple MUSTs: +الرحمن +الرحيم -بسم', () => {
    // Must have both الرحمن AND الرحيم but NOT بسم
    // Verse 1: has both but also has بسم ✗
    // Verse 3: has both, no بسم ✓
    const result = booleanSearch(
      '+الرحمن +الرحيم -بسم',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
    );
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(3);
  });
});

describe('booleanSearch - Edge cases', () => {
  it('should handle empty query', () => {
    const result = booleanSearch('', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it('should handle whitespace-only query', () => {
    const result = booleanSearch('   ', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
  });

  it('should handle query with only operators: + - |', () => {
    const result = booleanSearch('+ - |', mockQuranData, mockMorphologyMap, mockWordMap);
    // All verses should be returned (no actual terms to filter)
    expect(result.results.length).toBe(3);
  });

  it('should handle bare terms without operators', () => {
    // Just "الله" with no + should be treated as EITHER
    const result = booleanSearch('الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
  });

  it('should handle diacritics in query', () => {
    const result = booleanSearch('+ٱللَّهِ', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should handle non-Arabic query', () => {
    const result = booleanSearch('+xyz123', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(0);
  });
});

describe('booleanSearch - Pagination', () => {
  it('should handle pagination', () => {
    // Query that returns multiple results
    const result = booleanSearch(
      'الرحمن | الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 2 },
    );
    expect(result.results.length).toBeLessThanOrEqual(2);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.totalResults).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('should handle second page', () => {
    const result = booleanSearch(
      'الرحمن | الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 2, limit: 2 },
    );
    expect(result.results.length).toBe(1); // Third result
    expect(result.pagination.currentPage).toBe(2);
  });

  it('should handle page beyond results', () => {
    const result = booleanSearch(
      '+الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 10, limit: 20 },
    );
    expect(result.results).toHaveLength(0);
    expect(result.pagination.currentPage).toBe(10);
  });
});

describe('booleanSearch - Advanced options', () => {
  it('should respect lemma option', () => {
    const result = booleanSearch('+الله', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: false,
    });
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should respect root option', () => {
    const result = booleanSearch('+الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: false,
      root: true,
    });
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should respect fuzzy option when disabled', () => {
    // Misspelled word with fuzzy disabled
    const result = booleanSearch('+الحند', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      fuzzy: false,
    });
    expect(result.results).toHaveLength(0);
  });
});

describe('booleanSearch - Caching', () => {
  it('should cache identical queries', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);
    const options = { lemma: true, root: true };
    const pagination = { page: 1, limit: 20 };

    const first = booleanSearch(
      '+الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      options,
      pagination,
      undefined,
      cache,
    );
    const second = booleanSearch(
      '+الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      options,
      pagination,
      undefined,
      cache,
    );

    expect(second).toBe(first);
    expect(cache.size).toBeGreaterThan(0);
  });

  it('should work without cache', () => {
    const result = booleanSearch('+الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results.length).toBeGreaterThan(0);
  });
});

describe('booleanSearch - With inverted index', () => {
  it('should use inverted index when provided', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranData);
    const result = booleanSearch(
      '+الله',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      undefined,
      invertedIndex,
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.total).toBeGreaterThan(0);
  });

  it('should produce consistent results with and without index', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranData);

    const withIndex = booleanSearch(
      '+الرحمن -الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      undefined,
      invertedIndex,
    );

    const withoutIndex = booleanSearch(
      '+الرحمن -الحمد',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
    );

    expect(withIndex.counts.total).toBe(withoutIndex.counts.total);
    expect(withIndex.results.map((r) => r.gid).sort()).toEqual(
      withoutIndex.results.map((r) => r.gid).sort(),
    );
  });
});

describe('booleanSearch - Response structure', () => {
  it('should return proper SearchResponse structure', () => {
    const result = booleanSearch('+الله', mockQuranData, mockMorphologyMap, mockWordMap);

    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('pagination');

    expect(result.counts).toHaveProperty('simple');
    expect(result.counts).toHaveProperty('lemma');
    expect(result.counts).toHaveProperty('root');
    expect(result.counts).toHaveProperty('fuzzy');
    expect(result.counts).toHaveProperty('semantic');
    expect(result.counts).toHaveProperty('total');

    expect(result.pagination).toHaveProperty('totalResults');
    expect(result.pagination).toHaveProperty('totalPages');
    expect(result.pagination).toHaveProperty('currentPage');
    expect(result.pagination).toHaveProperty('limit');
  });

  it('should include scoring information in results', () => {
    const result = booleanSearch('+الله', mockQuranData, mockMorphologyMap, mockWordMap);

    expect(result.results.length).toBeGreaterThan(0);
    const firstResult = result.results[0];

    expect(firstResult).toHaveProperty('matchScore');
    expect(firstResult).toHaveProperty('matchType');
    expect(typeof firstResult.matchScore).toBe('number');
  });

  it('should sort results by relevance score', () => {
    const result = booleanSearch('الرحمن | الحمد', mockQuranData, mockMorphologyMap, mockWordMap);

    for (let i = 0; i < result.results.length - 1; i++) {
      expect(result.results[i].matchScore).toBeGreaterThanOrEqual(result.results[i + 1].matchScore);
    }
  });
});
