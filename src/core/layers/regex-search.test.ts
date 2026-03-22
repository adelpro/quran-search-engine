import { describe, it, expect } from 'vitest';
import { validateRegex, performRegexSearch } from './regex-search';
import { search } from '../search';
import { InvalidRegexError } from '../../errors';
import type { QuranText, MorphologyAya, ScoredVerse } from '../../types';

// ── shared mock data ──────────────────────────────────────────────────────────

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
};

const mockQuranDataMap = new Map((mockQuranData as QuranText[]).map((v) => [v.gid, v]));
const mockWordMapMap = new Map(Object.entries(mockWordMap));

// ── validateRegex ─────────────────────────────────────────────────────────────

describe('validateRegex', () => {
  it('compiles a valid Arabic suffix pattern', () => {
    const re = validateRegex('يم$');
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test('الرحيم')).toBe(true);
    expect(re.test('الرحمن')).toBe(false);
  });

  it('compiles anchored patterns correctly', () => {
    const re = validateRegex('^الله');
    expect(re.test('الله الرحمن')).toBe(true);
    expect(re.test('بسم الله')).toBe(false);
  });

  it('throws InvalidRegexError for a syntactically invalid pattern', () => {
    expect(() => validateRegex('[')).toThrow(InvalidRegexError);
    expect(() => validateRegex('[')).toThrow(/not valid regular expression syntax/);
  });

  it('throws InvalidRegexError for a pattern with nested quantifiers (ReDoS)', () => {
    expect(() => validateRegex('(ا+)+')).toThrow(InvalidRegexError);
    expect(() => validateRegex('(ا+)+')).toThrow(/nested quantifiers/);
  });

  it('throws InvalidRegexError for alternation inside a quantified group (ReDoS)', () => {
    expect(() => validateRegex('(ا|ب)+')).toThrow(InvalidRegexError);
    expect(() => validateRegex('(ا|ب)+')).toThrow(/nested quantifiers/);
  });

  it('accepts a safe alternation pattern without outer quantifier', () => {
    const re = validateRegex('(الرحمن|الرحيم)');
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test('الرحمن')).toBe(true);
  });
});

// ── performRegexSearch ────────────────────────────────────────────────────────

describe('performRegexSearch', () => {
  it('matches verses ending with يم', () => {
    const re = validateRegex('يم$');
    const results = performRegexSearch(re, mockQuranData);
    // verses 1 (الرحيم) and 3 (الرحيم) both end with يم
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r: ScoredVerse<QuranText>) => r.matchType === 'regex')).toBe(true);
    expect(results.every((r: ScoredVerse<QuranText>) => r.matchScore === 1)).toBe(true);
  });

  it('returns empty array when no verse matches', () => {
    const re = validateRegex('^zzz');
    expect(performRegexSearch(re, mockQuranData)).toHaveLength(0);
  });

  it('all results have empty matchedTokens', () => {
    const re = validateRegex('الله');
    const results = performRegexSearch(re, mockQuranData);
    expect(results.every((r: ScoredVerse<QuranText>) => r.matchedTokens.length === 0)).toBe(true);
  });

  it('matches against normalized text (ignores diacritics)', () => {
    // "الرَّحْمَنِ" with tashkeel should still match via normalization
    const re = validateRegex('الرحمن');
    const results = performRegexSearch(re, mockQuranData);
    expect(results.some((r: ScoredVerse<QuranText>) => r.gid === 1)).toBe(true);
    expect(results.some((r: ScoredVerse<QuranText>) => r.gid === 3)).toBe(true);
  });
});

// ── search() with isRegex option ──────────────────────────────────────────────

describe('search() with isRegex: true', () => {
  it('returns regex-tagged results for a suffix pattern', () => {
    const result = search(
      'يم$',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: true,
        root: true,
        isRegex: true,
      },
    );
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r: ScoredVerse<QuranText>) => r.matchType === 'regex')).toBe(true);
    expect(result.counts.regex).toBe(result.counts.total);
    expect(result.counts.simple).toBe(0);
    expect(result.counts.lemma).toBe(0);
  });

  it('counts total correctly', () => {
    const result = search(
      'الرحمن',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: false,
        root: false,
        isRegex: true,
      },
    );
    expect(result.counts.total).toBe(result.counts.regex);
    expect(result.pagination.totalResults).toBe(result.counts.total);
  });

  it('paginates regex results', () => {
    const result = search(
      'ا',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: false,
        root: false,
        isRegex: true,
      },
      { page: 1, limit: 1 },
    );
    expect(result.results).toHaveLength(1);
    expect(result.pagination.limit).toBe(1);
    expect(result.pagination.totalResults).toBeGreaterThanOrEqual(1);
  });

  it('throws InvalidRegexError for an invalid pattern passed through search()', () => {
    expect(() =>
      search(
        '[',
        { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
        {
          lemma: false,
          root: false,
          isRegex: true,
        },
      ),
    ).toThrow(InvalidRegexError);
  });

  it('throws InvalidRegexError for a ReDoS pattern passed through search()', () => {
    expect(() =>
      search(
        '(ا+)+',
        { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
        {
          lemma: false,
          root: false,
          isRegex: true,
        },
      ),
    ).toThrow(InvalidRegexError);
  });

  it('respects suraId filter alongside regex', () => {
    // All mock verses belong to sura_id 1 — filtering by suraId=2 should yield 0
    const result = search(
      'الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: false,
        root: false,
        isRegex: true,
        suraId: 2,
      },
    );
    expect(result.results).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it('returns all matches when isRegex is false (normal search unaffected)', () => {
    const result = search(
      'الله',
      { quranData: mockQuranDataMap, morphologyMap: mockMorphologyMap, wordMap: mockWordMapMap },
      {
        lemma: true,
        root: true,
        isRegex: false,
      },
    );
    // Should use the normal pipeline, not the regex branch
    expect(result.results.every((r: ScoredVerse<QuranText>) => r.matchType !== 'regex')).toBe(true);
  });
});
