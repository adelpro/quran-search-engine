import { describe, it, expect } from 'vitest';
import {
  validateVerseInput,
  validateQuranData,
  validateMorphologyMap,
  validateWordMap,
} from './validation';

describe('validateVerseInput', () => {
  it('passes for a valid verse', () => {
    const errors = validateVerseInput({ gid: 1, uthmani: 'بِسْمِ', standard: 'بسم' });
    expect(errors).toHaveLength(0);
  });

  it('fails for null', () => {
    const errors = validateVerseInput(null);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails for negative gid', () => {
    const errors = validateVerseInput({ gid: -1, uthmani: 'بسم', standard: 'بسم' });
    expect(errors.some((e) => e.field === 'gid')).toBe(true);
  });

  it('fails for empty uthmani', () => {
    const errors = validateVerseInput({ gid: 1, uthmani: '', standard: 'بسم' });
    expect(errors.some((e) => e.field === 'uthmani')).toBe(true);
  });

  it('fails for missing standard', () => {
    const errors = validateVerseInput({ gid: 1, uthmani: 'بسم' });
    expect(errors.some((e) => e.field === 'standard')).toBe(true);
  });
});

describe('validateQuranData', () => {
  const validData = [
    { gid: 1, uthmani: 'بِسْمِ', standard: 'بسم', sura_id: 1, aya_id: 1 },
    { gid: 2, uthmani: 'ٱللَّهِ', standard: 'الله', sura_id: 1, aya_id: 1 },
  ];

  it('passes for valid data', () => {
    const result = validateQuranData(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for empty array', () => {
    const result = validateQuranData([]);
    expect(result.valid).toBe(false);
  });

  it('fails for duplicate gids', () => {
    const result = validateQuranData([
      { gid: 1, uthmani: 'بسم', standard: 'بسم' },
      { gid: 1, uthmani: 'الله', standard: 'الله' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });
});

describe('validateMorphologyMap', () => {
  it('passes for valid map', () => {
    const map = new Map([[1, { gid: 1, lemmas: ['الله'], roots: ['اله'] }]]);
    const result = validateMorphologyMap(map);
    expect(result.valid).toBe(true);
  });

  it('fails for non-Map input', () => {
    const result = validateMorphologyMap({} as never);
    expect(result.valid).toBe(false);
  });
});

describe('validateWordMap', () => {
  it('passes for valid wordMap', () => {
    const result = validateWordMap({ الله: { lemma: 'الله', root: 'اله' } });
    expect(result.valid).toBe(true);
  });

  it('fails for array input', () => {
    const result = validateWordMap([] as never);
    expect(result.valid).toBe(false);
  });

  it('fails for non-string lemma', () => {
    const result = validateWordMap({ الله: { lemma: 123 as never } });
    expect(result.valid).toBe(false);
  });
});

describe('validateQuranData - edge cases', () => {
  it('fails gracefully for null entries without throwing', () => {
    const result = validateQuranData([null as never]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateMorphologyMap - string content', () => {
  it('fails if lemmas contains non-strings', () => {
    const map = new Map([[1, { gid: 1, lemmas: [123 as never], roots: ['اله'] }]]);
    const result = validateMorphologyMap(map);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'morphologyMap.lemmas')).toBe(true);
  });

  it('fails if roots contains non-strings', () => {
    const map = new Map([[1, { gid: 1, lemmas: ['الله'], roots: [null as never] }]]);
    const result = validateMorphologyMap(map);
    expect(result.valid).toBe(false);
  });
});

describe('validateWordMap - plain object check', () => {
  it('fails for Map instance', () => {
    const result = validateWordMap(new Map() as never);
    expect(result.valid).toBe(false);
  });

  it('fails for Date instance', () => {
    const result = validateWordMap(new Date() as never);
    expect(result.valid).toBe(false);
  });
});
