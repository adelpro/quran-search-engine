import { describe, it, expect } from 'vitest';
import { createArabicFuseSearch } from './fuse-search';
import type { QuranText } from '../../types';

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
];

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
