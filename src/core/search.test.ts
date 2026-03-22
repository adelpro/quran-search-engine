import { describe, it, expect } from 'vitest';
import { search } from './search';
import type { QuranText, MorphologyAya } from '../types';

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

const mockQuranDataMap = new Map((mockQuranData as QuranText[]).map((v) => [v.gid, v]));

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

const mockWordMap = {
  الله: { lemma: 'الله', root: 'ا ل ه' },
  الرحمن: { lemma: 'الرحمن', root: 'ر ح م' },
  الحمد: { lemma: 'الحمد', root: 'ح م د' },
};

const mockWordMapMap = new Map(Object.entries(mockWordMap));

const mockPhoneticMap = new Map([
  ['bismi', ['بسم']],
  ['allahi', ['الله']],
]);

describe('Search Orchestrator (Integration)', () => {
  it('should find exact matches with Arabic query', () => {
    const result = search('الله', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(1);
    expect(result.results[0].matchType).toBe('exact');
  });

  it('should find phonetic matches with Latin query', () => {
    const result = search('bismi allahi', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
      phoneticMap: mockPhoneticMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(1);
  });

  it('should handle range queries (e.g. 1:1)', () => {
    const result = search('1:1', {
      quranData: mockQuranDataMap,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMapMap,
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].gid).toBe(1);
    expect(result.results[0].matchType).toBe('range');
  });

  it('should perform semantic search when specified', () => {
    const result = search(
      'الرحمن',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
      },
      {
        lemma: true,
        root: true,
        semantic: true,
      },
    );
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should support regex queries', () => {
    const result = search(
      '^الحمد',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
      },
      {
        lemma: false,
        root: false,
        isRegex: true,
      },
    );
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(2);
  });

  it('should respect pagination options', () => {
    const limit = 1;
    const result = search(
      'الرحمن',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMapMap,
      },
      undefined,
      {
        page: 1,
        limit,
      },
    );
    expect(result.results.length).toBeLessThanOrEqual(limit);
    expect(result.pagination.limit).toBe(limit);
  });
});
