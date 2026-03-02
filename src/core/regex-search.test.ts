import { describe, it, expect } from 'vitest';
import { validateRegex } from './regex-search';
import { search } from './search';
import type { QuranText, WordMap, MorphologyAya } from '../types';

// Reuse mock data from search.test.ts
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

describe('validateRegex', () => {
  it('accepts valid simple regex', () => {
    expect(validateRegex('الرحم')).toEqual({ valid: true });
  });

  it('accepts regex with character class', () => {
    expect(validateRegex('[اب]')).toEqual({ valid: true });
  });

  it('accepts regex with anchors', () => {
    expect(validateRegex('^الحمد')).toEqual({ valid: true });
  });

  it('rejects invalid regex syntax', () => {
    const result = validateRegex('[unclosed');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects catastrophic backtracking patterns', () => {
    const result = validateRegex('(a+)+$');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('backtracking');
  });

  it('rejects nested quantifiers', () => {
    const result = validateRegex('(.*)*');
    expect(result.valid).toBe(false);
  });

  it('rejects deeply nested groups', () => {
    const result = validateRegex('((((((((((a))))))))))');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('nesting');
  });

  it('accepts empty string', () => {
    expect(validateRegex('')).toEqual({ valid: true });
  });

  it('rejects extremely long patterns', () => {
    const result = validateRegex('ا'.repeat(1001));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('long');
  });

  it('rejects {n,m} outer quantifier on group with inner quantifier', () => {
    const result = validateRegex('(a+){2,20}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('backtracking');
  });

  it('rejects quantified alternation groups', () => {
    const result = validateRegex('(a|aa)+');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('alternation');
  });

  it('does not false-positive on escaped parens', () => {
    // Six literal escaped parens — not actual groups
    expect(validateRegex('\\(\\(\\(\\(\\(\\(')).toEqual({ valid: true });
  });

  it('does not false-positive on parens in character classes', () => {
    expect(validateRegex('[(][(][(][(][(][(]')).toEqual({ valid: true });
  });

  it('accepts safe alternation without quantifier', () => {
    expect(validateRegex('(الله|الرحمن)')).toEqual({ valid: true });
  });
});

describe('regex search via search()', () => {
  it('finds verses matching a simple pattern', () => {
    // الرحم matches الرحمن and الرحيم
    const result = search('الرحم', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1); // بسم الله الرحمن الرحيم
    expect(gids).toContain(3); // الرحمن الرحيم
  });

  it('finds verses with suffix pattern', () => {
    // Words ending in ين
    const result = search('ين$', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(2); // العالمين ends with ين
  });

  it('finds verses with prefix pattern', () => {
    // Starts with الحمد
    const result = search('^الحمد', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(2);
    expect(gids).not.toContain(1);
    expect(gids).not.toContain(3);
  });

  it('returns empty results for non-matching pattern', () => {
    const result = search('xyz', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    expect(result.results).toHaveLength(0);
  });

  it('returns empty results for invalid regex', () => {
    const result = search('[unclosed', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    expect(result.results).toHaveLength(0);
  });

  it('returns empty results for unsafe regex', () => {
    const result = search('(a+)+$', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    expect(result.results).toHaveLength(0);
  });

  it('pagination works with regex results', () => {
    const result = search(
      'الرحم',
      mockQuranData,
      mockMorphologyMap,
      mockWordMap,
      { lemma: true, root: true, isRegex: true },
      { page: 1, limit: 1 },
    );
    expect(result.results).toHaveLength(1);
    expect(result.pagination.limit).toBe(1);
    expect(result.pagination.totalResults).toBeGreaterThan(1);
  });

  it('without isRegex, search behaves normally', () => {
    const result = search('الله', mockQuranData, mockMorphologyMap, mockWordMap);
    expect(result.results).toHaveLength(2);
  });

  it('matchType is exact for regex matches', () => {
    const result = search('الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    expect(result.results.length).toBeGreaterThan(0);
    result.results.forEach((r) => {
      expect(r.matchType).toBe('exact');
    });
  });

  it('normalizes diacritics in pattern before matching', () => {
    // ٱلرَّحْمَٰنِ with tashkeel — should match after normalization
    const result = search('ٱلرَّحْمَٰنِ', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    const gids = result.results.map((r) => r.gid);
    expect(gids).toContain(1);
    expect(gids).toContain(3);
  });

  it('matchedTokens contains the matched text', () => {
    const result = search('الرحمن', mockQuranData, mockMorphologyMap, mockWordMap, {
      lemma: true,
      root: true,
      isRegex: true,
    });
    expect(result.results.length).toBeGreaterThan(0);
    result.results.forEach((r) => {
      expect(r.matchedTokens.length).toBeGreaterThan(0);
    });
  });
});
