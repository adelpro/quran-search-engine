import { describe, it, expect } from 'vitest';
import { SURAS } from './suras';
import type { VerseInput } from '../types';
import quranData from '../data/quran.json';

describe('SURAS metadata', () => {
  it('should have exactly 114 suras', () => {
    expect(SURAS.length).toBe(114);
  });

  it('should have correct verse counts', () => {
    const quranAyatArray = (
      Array.isArray(quranData) ? quranData : Object.values(quranData)
    ) as VerseInput[];
    SURAS.forEach((sura) => {
      const versesInQuran = quranAyatArray.filter(
        (aya: VerseInput) => aya.sura_id === sura.id,
      ).length;
      expect(sura.total_verses).toBe(versesInQuran);
    });
  });

  it('should have unique and sorted juz_ids', () => {
    SURAS.forEach((sura) => {
      const isSorted = sura.juz_ids.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
      expect(isSorted).toBe(true);

      const hasDuplicates = new Set(sura.juz_ids).size !== sura.juz_ids.length;
      expect(hasDuplicates).toBe(false);
    });
  });
});
