import { describe, it, expect } from 'vitest';
import { parseRangeQuery, filterVersesByRange } from './range-parser';
import type { QuranText } from '../types';

// Mock verse data (Al-Fatihah, 7 verses)
const mockVerses: QuranText[] = [
  {
    gid: 1,
    sura_id: 1,
    aya_id: 1,
    aya_id_display: '1',
    uthmani: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِیمِ',
    standard: 'بسم الله الرحمن الرحيم',
    standard_full: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    page_id: 1,
    juz_id: 1,
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 2,
    sura_id: 1,
    aya_id: 2,
    aya_id_display: '2',
    uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    standard: 'الحمد لله رب العالمين',
    standard_full: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    page_id: 1,
    juz_id: 1,
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 3,
    sura_id: 1,
    aya_id: 3,
    aya_id_display: '3',
    uthmani: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    standard: 'الرحمن الرحيم',
    standard_full: 'الرَّحْمَنِ الرَّحِيمِ',
    page_id: 1,
    juz_id: 1,
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 4,
    sura_id: 1,
    aya_id: 4,
    aya_id_display: '4',
    uthmani: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
    standard: 'مالك يوم الدين',
    standard_full: 'مَالِكِ يَوْمِ الدِّينِ',
    page_id: 1,
    juz_id: 1,
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
];

describe('parseRangeQuery', () => {
  describe('valid queries', () => {
    it('should parse a single verse query', () => {
      expect(parseRangeQuery('2:255')).toEqual({ sura: 2, startAya: 255 });
    });

    it('should parse a verse range query', () => {
      expect(parseRangeQuery('1:1-7')).toEqual({ sura: 1, startAya: 1, endAya: 7 });
    });

    it('should parse a bare sura query', () => {
      expect(parseRangeQuery('2:')).toEqual({ sura: 2 });
    });

    it('should handle whitespace around components', () => {
      expect(parseRangeQuery('  2 : 255  ')).toEqual({ sura: 2, startAya: 255 });
      expect(parseRangeQuery(' 1 : 1 - 7 ')).toEqual({ sura: 1, startAya: 1, endAya: 7 });
      expect(parseRangeQuery('  2 :  ')).toEqual({ sura: 2 });
    });

    it('should parse edge cases at boundaries', () => {
      expect(parseRangeQuery('1:1')).toEqual({ sura: 1, startAya: 1 });
      expect(parseRangeQuery('114:6')).toEqual({ sura: 114, startAya: 6 });
      expect(parseRangeQuery('1:1-1')).toEqual({ sura: 1, startAya: 1, endAya: 1 });
    });
  });

  describe('invalid queries', () => {
    it('should return null for sura 0', () => {
      expect(parseRangeQuery('0:1')).toBeNull();
    });

    it('should return null for sura > 114', () => {
      expect(parseRangeQuery('115:1')).toBeNull();
    });

    it('should return null for aya 0', () => {
      expect(parseRangeQuery('1:0')).toBeNull();
    });

    it('should return null for reversed ranges', () => {
      expect(parseRangeQuery('2:5-3')).toBeNull();
    });

    it('should return null for plain text', () => {
      expect(parseRangeQuery('الرحمن')).toBeNull();
    });

    it('should return null for mixed text and range', () => {
      expect(parseRangeQuery('sura 2:255')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseRangeQuery('')).toBeNull();
    });

    it('should return null for just a number without colon', () => {
      expect(parseRangeQuery('2')).toBeNull();
    });

    it('should return null for negative numbers', () => {
      expect(parseRangeQuery('-1:1')).toBeNull();
    });

    it('should return null for non-numeric content', () => {
      expect(parseRangeQuery('abc:def')).toBeNull();
    });

    it('should return null for only a colon', () => {
      expect(parseRangeQuery(':')).toBeNull();
    });
  });
});

describe('filterVersesByRange', () => {
  it('should filter a single verse', () => {
    const range = parseRangeQuery('1:2')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(1);
    expect(results[0].gid).toBe(2);
  });

  it('should filter a verse range', () => {
    const range = parseRangeQuery('1:1-3')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(3);
    expect(results.map((v) => v.aya_id)).toEqual([1, 2, 3]);
  });

  it('should return all verses for a bare sura query', () => {
    const range = parseRangeQuery('1:')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(4);
  });

  it('should return empty array when sura is not found', () => {
    const range = parseRangeQuery('2:1')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(0);
  });

  it('should return empty array when aya is out of range', () => {
    const range = parseRangeQuery('1:99')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty data', () => {
    const range = parseRangeQuery('1:1')!;
    const results = filterVersesByRange([], range);
    expect(results).toHaveLength(0);
  });

  it('should return empty array when verses lack coordinate fields', () => {
    const versesWithoutCoords = [{ gid: 1, uthmani: 'test', standard: 'test' }];
    const range = parseRangeQuery('1:1')!;
    const results = filterVersesByRange(versesWithoutCoords, range);
    expect(results).toHaveLength(0);
  });

  it('should handle a range with equal start and end', () => {
    const range = parseRangeQuery('1:2-2')!;
    const results = filterVersesByRange(mockVerses, range);
    expect(results).toHaveLength(1);
    expect(results[0].aya_id).toBe(2);
  });
});
