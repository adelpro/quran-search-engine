import { describe, it, expect } from 'vitest';
import { getPositiveTokens } from './tokenization';
import type { QuranText, MorphologyAya, WordMap } from '../types';

// Mock data
const mockVerse: QuranText = {
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
};

const mockMorphologyMap = new Map<number, MorphologyAya>([
  [
    1,
    {
      gid: 1,
      lemmas: ['بسم', 'الله', 'الرحمن', 'الرحيم'],
      roots: ['ب س م', 'ا ل ه', 'ر ح م', 'ر ح م'],
    },
  ],
]);

const mockWordMap: WordMap = {
  الله: { lemma: 'الله', root: 'ا ل ه' },
  الرحمن: { lemma: 'الرحمن', root: 'ر ح م' },
  الرحيم: { lemma: 'الرحيم', root: 'ر ح م' },
  بسم: { lemma: 'بسم', root: 'ب س م' },
};

describe('getPositiveTokens', () => {
  it('should find text matches', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'text',
      undefined,
      undefined,
      'الله',
      mockMorphologyMap,
    );

    expect(tokens).toContain('الله');
  });

  it('should find lemma matches', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'lemma',
      'الله',
      undefined,
      'الله',
      mockMorphologyMap,
    );

    expect(tokens).toContain('الله');
  });

  it('should find root matches using word map', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'root',
      undefined,
      'ا ل ه',
      'الله',
      mockMorphologyMap,
      mockWordMap,
    );

    expect(tokens).toContain('الله');
  });

  it('should fallback to morphology roots without word map', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'root',
      undefined,
      'ا ل ه',
      'الله',
      mockMorphologyMap,
    );

    expect(tokens).toContain('ا ل ه');
  });

  it('should return empty array for no matches', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'text',
      undefined,
      undefined,
      'xyz',
      mockMorphologyMap,
    );

    expect(tokens).toHaveLength(0);
  });

  it('should handle empty query', () => {
    const tokens = getPositiveTokens(
      mockVerse,
      'text',
      undefined,
      undefined,
      '',
      mockMorphologyMap,
    );

    expect(tokens).toHaveLength(0);
  });
});
