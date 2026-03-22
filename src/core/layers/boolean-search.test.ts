import { describe, it, expect } from 'vitest';
import { LRUCache } from '../../utils/lru-cache';
import { buildInvertedIndex } from '../../utils/loader';
import type { QuranText, MorphologyAya, SearchResponse } from '../../types';
import { search } from '../search';
import { InvalidQueryError } from '../../errors';

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

const mockWordMap: Record<string, { lemma: string; root: string }> = {
  الله: { lemma: 'الله', root: 'ا ل ه' },
  الرحمن: { lemma: 'الرحمن', root: 'ر ح م' },
  الحمد: { lemma: 'الحمد', root: 'ح م د' },
  الرحيم: { lemma: 'الرحيم', root: 'ر ح م' },
  بسم: { lemma: 'بسم', root: 'ب س م' },
  رب: { lemma: 'رب', root: 'ر ب ب' },
  العالمين: { lemma: 'العالمين', root: 'ع ل م' },
};

const mockQuranDataMap = new Map((mockQuranData as QuranText[]).map((v) => [v.gid, v]));
const mockWordMapMap = new Map(Object.entries(mockWordMap));

describe('search - MUST operator (+)', () => {
  it('should find verses that MUST contain a term: +الله', () => {
    // الله appears in verse 1 (بسم الله...)
    // Note: verse 2 has لله (not الله), so substring match excludes it
    const result = search('+الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2); // Verse 2 has لله not الله
    expect(gids).not.toContain(3); // Verse 3 doesn't have الله
  });

  it('should find verses with multiple MUST terms: +الله +الرحمن', () => {
    // Both الله AND الرحمن appear together only in verse 1
    const result = search('+الله +الرحمن', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2); // Verse 2 has الله but not الرحمن
    expect(gids).not.toContain(3); // Verse 3 has الرحمن but not الله
  });

  it('should return empty when MUST term does not exist', () => {
    const result = search('+كلمةغيرموجودة', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it('should handle MUST with three terms: +الرحمن +الرحيم +بسم', () => {
    // All three appear together only in verse 1
    const result = search('+الرحمن +الرحيم +بسم', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(1);
  });
});

describe('search - EXCLUDE operator (-)', () => {
  it('should exclude verses containing a term: -الله', () => {
    // Search for الرحمن, exclude verses with الله → verses 1 and 3 have الرحمن, verse 1 has الله, so only verse 3 remains
    const result = search('الرحمن -الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(3);
    expect(gids).not.toContain(1);
    expect(gids).not.toContain(2);
  });

  it('should exclude verses containing a term: -العالمين', () => {
    // Search for بسم, exclude العالمين → بسم in verse 1, العالمين in verse 2, so verse 1 remains
    const result = search('بسم -العالمين', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2);
  });

  it('should handle multiple EXCLUDE terms: -الله -العالمين', () => {
    // Search for الرحمن, exclude الله and العالمين → only verse 3 remains
    const result = search('الرحمن -الله -العالمين', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(3);
  });

  it('should return no results when search term does not exist', () => {
    // Boolean search requires at least one search term, not just exclusions
    const result = search('كلمةغيرموجودة', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(0);
  });
});

describe('search - EITHER operator (|)', () => {
  it('should find verses with either term: الرحمن | الحمد', () => {
    // Searches for both terms, then filters: verses with الرحمن (1, 3) OR الحمد (2)
    const result = search('الرحمن | الحمد', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(3);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(gids).toContain(3);
  });

  it('should find verses with either term: بسم | العالمين', () => {
    // بسم in verse 1; العالمين in verse 2
    const result = search('بسم | العالمين', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(gids).not.toContain(3);
  });

  it('should handle OR with non-existent term: الله | كلمةغيرموجودة', () => {
    // الله exists in verse 1 only (verse 2 has لله not الله)
    const result = search('الله | كلمةغيرموجودة', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2);
  });

  it('should return empty when no OR terms exist', () => {
    const result = search('كلمة1 | كلمة2', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results).toHaveLength(0);
  });
});

describe('search - Combined operators', () => {
  it('should combine MUST and EXCLUDE: +الله -الرحمن', () => {
    // الله is in verse 1 only (verse 2 has لله not الله); الرحمن is in verses 1, 3
    // So: has الله but NOT الرحمن → no results (verse 1 has both)
    const result = search('+الله -الرحمن', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(0);
  });

  it('should combine MUST and OR: +الله الرحمن | العالمين', () => {
    // Must have الله AND (الرحمن OR العالمين)
    // Verse 1: has الله and الرحمن ✓
    // Verse 2: has لله (not الله) ✗
    const result = search('+الله الرحمن | العالمين', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).not.toContain(2);
  });

  it('should combine OR and EXCLUDE: الرحمن | الحمد -العالمين', () => {
    // (الرحمن OR الحمد) AND NOT العالمين
    // Verse 1: has الرحمن, no العالمين ✓
    // Verse 2: has الحمد, has العالمين ✗
    // Verse 3: has الرحمن, no العالمين ✓
    const result = search('الرحمن | الحمد -العالمين', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
    expect(gids).not.toContain(2);
  });

  it('should combine all operators: +الرحمن الرحيم | بسم -الحمد', () => {
    // Must have الرحمن AND (الرحيم OR بسم) AND NOT الحمد
    // Verse 1: has الرحمن, has both الرحيم and بسم, no الحمد ✓
    // Verse 3: has الرحمن, has الرحيم, no بسم but has الرحيم so passes OR ✓
    const result = search('+الرحمن الرحيم | بسم -الحمد', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(2);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
  });

  it('should handle complex query with multiple MUSTs: +الرحمن +الرحيم -بسم', () => {
    // Must have both الرحمن AND الرحيم but NOT بسم
    // Verse 1: has both but also has بسم ✗
    // Verse 3: has both, no بسم ✓
    const result = search('+الرحمن +الرحيم -بسم', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBe(1);
    expect(result.results[0].gid).toBe(3);
  });
});

describe('search - Edge cases', () => {
  it('should throw InvalidQueryError for empty query', () => {
    expect(() =>
      search('', {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
      }),
    ).toThrow(InvalidQueryError);
  });

  it('should throw InvalidQueryError for whitespace-only query', () => {
    expect(() =>
      search('   ', {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
      }),
    ).toThrow(InvalidQueryError);
  });

  it('should handle query with only operators: + - |', () => {
    const result = search('+ - |', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    // After cleaning operators, query is empty → no search results
    expect(result.results.length).toBe(0);
  });

  it('should handle bare terms without operators', () => {
    // Just "الله" with no operators - normal search behavior
    const result = search('الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    // Verse 2 has لله not الله, so linguistic matching might find it but boolean won't filter it
  });

  it('should handle diacritics in query', () => {
    const result = search('+ٱللَّهِ', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    // Diacritics are normalized, should find الله
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should handle non-Arabic query', () => {
    const result = search('+xyz123', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results).toHaveLength(0);
  });
});

describe('search - Pagination', () => {
  it('should handle pagination', () => {
    // Query that returns multiple results (3 verses)
    const result = search(
      'الرحمن | الحمد',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      { lemma: true, root: true },
      { page: 1, limit: 2 },
    );
    expect(result.results.length).toBeLessThanOrEqual(2);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.totalResults).toBeGreaterThanOrEqual(2);
  });

  it('should handle second page', () => {
    const result = search(
      'الرحمن | الحمد',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      { lemma: true, root: true },
      { page: 2, limit: 2 },
    );
    // Should have remaining results on page 2
    expect(result.pagination.currentPage).toBe(2);
  });

  it('should handle page beyond results', () => {
    const result = search(
      '+الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      { lemma: true, root: true },
      { page: 10, limit: 20 },
    );
    expect(result.results).toHaveLength(0);
    expect(result.pagination.currentPage).toBe(10);
  });
});

describe('search - Advanced options', () => {
  it('should respect lemma option', () => {
    const result = search(
      '+الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: true,
        root: false,
      },
    );
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should respect root option', () => {
    const result = search(
      '+الرحمن',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: false,
        root: true,
      },
    );
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should respect fuzzy option when disabled', () => {
    // Misspelled word with fuzzy disabled
    const result = search(
      '+الحند',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: true,
        root: true,
        fuzzy: false,
      },
    );
    expect(result.results).toHaveLength(0);
  });
});

describe('search - Caching', () => {
  it('should cache identical queries', () => {
    const cache = new LRUCache<string, SearchResponse<QuranText>>(10);
    const options = { lemma: true, root: true };
    const pagination = { page: 1, limit: 20 };

    const first = search(
      '+الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      options,
      pagination,
      undefined,
      cache,
    );
    const second = search(
      '+الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      options,
      pagination,
      undefined,
      cache,
    );

    expect(second).toBe(first);
    expect(cache.size).toBeGreaterThan(0);
  });

  it('should work without cache', () => {
    const result = search('+الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
  });
});

describe('search - With inverted index', () => {
  it('should use inverted index when provided', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranDataMap);
    const result = search(
      '+الله',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
        invertedIndex,
      },
      { lemma: true, root: true },
      { page: 1, limit: 20 },
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.total).toBeGreaterThan(0);
  });

  it('should produce consistent results with and without index', () => {
    const invertedIndex = buildInvertedIndex(mockMorphologyMap, mockQuranDataMap);

    const withIndex = search(
      '+الرحمن -الحمد',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
        invertedIndex,
      },
      { lemma: true, root: true },
      { page: 1, limit: 20 },
    );

    const withoutIndex = search(
      '+الرحمن -الحمد',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      { lemma: true, root: true },
      { page: 1, limit: 20 },
    );

    expect(withIndex.counts.total).toBe(withoutIndex.counts.total);
    expect(withIndex.results.map((r) => r.gid).sort()).toEqual(
      withoutIndex.results.map((r) => r.gid).sort(),
    );
  });
});

describe('search - Response structure', () => {
  it('should return proper SearchResponse structure', () => {
    const result = search('+الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });

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
    const result = search('+الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });

    expect(result.results.length).toBeGreaterThan(0);
    const firstResult = result.results[0];

    expect(firstResult).toHaveProperty('matchScore');
    expect(firstResult).toHaveProperty('matchType');
    expect(typeof firstResult.matchScore).toBe('number');
  });

  it('should sort results by relevance score', () => {
    const result = search('الرحمن | الحمد', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });

    for (let i = 0; i < result.results.length - 1; i++) {
      expect(result.results[i].matchScore).toBeGreaterThanOrEqual(result.results[i + 1].matchScore);
    }
  });
});
