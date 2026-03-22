import { describe, it, expect } from 'vitest';

import {
  formatSchemaErrors,
  validateMorphologyData,
  validateQuranData,
  validateSemanticData,
  validateWordMapData,
} from './schema';

// ─── validateQuranData ─────────────────────────────────────────────────────

describe('validateQuranData', () => {
  it('accepts a valid minimal VerseInput array', () => {
    const data = [
      { gid: 1, uthmani: 'بِسْمِ', standard: 'بسم' },
      { gid: 2, uthmani: 'ٱلْحَمْدُ', standard: 'الحمد' },
    ];
    const result = validateQuranData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a full QuranText record', () => {
    const data = [
      {
        gid: 1,
        sura_id: 1,
        aya_id: 1,
        aya_id_display: '١',
        uthmani: 'بِسْمِ',
        standard: 'بسم',
        standard_full: 'بِسْمِ',
        page_id: 1,
        juz_id: 1,
        sura_name: 'الفاتحة',
        sura_name_en: 'The Opening',
        sura_name_romanization: 'Al-Fatihah',
      },
    ];
    expect(validateQuranData(data).valid).toBe(true);
  });

  it('rejects non-array input', () => {
    const result = validateQuranData('not an array');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('array');
  });

  it('rejects an empty array', () => {
    const result = validateQuranData([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('empty');
  });

  it('reports missing required fields', () => {
    const data = [{ sura_id: 1 }]; // missing gid, uthmani, standard
    const result = validateQuranData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['verses[0].gid', 'verses[0].uthmani', 'verses[0].standard']),
    );
  });

  it('reports wrong types on optional fields', () => {
    const data = [{ gid: 1, uthmani: 'x', standard: 'x', sura_id: 'not a number' }];
    const result = validateQuranData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('verses[0].sura_id');
  });

  it('handles null items in the array', () => {
    const data = [null];
    const result = validateQuranData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('object');
  });

  it('respects the error limit', () => {
    const data = Array.from({ length: 100 }, () => ({}));
    const result = validateQuranData(data, 5);
    expect(result.errors.length).toBeLessThanOrEqual(5);
  });
});

// ─── validateMorphologyData ────────────────────────────────────────────────

describe('validateMorphologyData', () => {
  it('accepts valid morphology data', () => {
    const data = [{ gid: 1, lemmas: ['اسم', 'الله'], roots: ['س-م-و', 'ا-ل-ه'] }];
    expect(validateMorphologyData(data).valid).toBe(true);
  });

  it('rejects non-array input', () => {
    const result = validateMorphologyData({});
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateMorphologyData([]);
    expect(result.valid).toBe(false);
  });

  it('reports missing gid', () => {
    const data = [{ lemmas: ['x'], roots: ['y'] }];
    const result = validateMorphologyData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('morphology[0].gid');
  });

  it('reports non-array lemmas', () => {
    const data = [{ gid: 1, lemmas: 'not array', roots: ['y'] }];
    const result = validateMorphologyData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('morphology[0].lemmas');
  });

  it('reports non-string items inside roots', () => {
    const data = [{ gid: 1, lemmas: ['ok'], roots: [42] }];
    const result = validateMorphologyData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('morphology[0].roots');
    expect(result.errors[0].message).toContain('strings');
  });
});

// ─── validateWordMapData ───────────────────────────────────────────────────

describe('validateWordMapData', () => {
  it('accepts a valid word map', () => {
    const data = {
      بسم: { lemma: 'اسم', root: 'س-م-و' },
      الله: { lemma: 'الله' },
      فيها: {},
    };
    expect(validateWordMapData(data).valid).toBe(true);
  });

  it('rejects array input', () => {
    expect(validateWordMapData([]).valid).toBe(false);
  });

  it('rejects null', () => {
    expect(validateWordMapData(null).valid).toBe(false);
  });

  it('rejects empty object', () => {
    const result = validateWordMapData({});
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('empty');
  });

  it('reports non-object values', () => {
    const data = { بسم: 'not an object' };
    const result = validateWordMapData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toContain('بسم');
  });

  it('reports wrong type for lemma field', () => {
    const data = { بسم: { lemma: 123 } };
    const result = validateWordMapData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toContain('lemma');
  });
});

// ─── validateSemanticData ─────────────────────────────────────────────────

describe('validateSemanticData', () => {
  const validEntry = {
    english: ['Hereafter', 'Afterlife'],
    arabic: ['الآخرة', 'دار القرار'],
    category: 'Eschatology',
    notes: 'الآخرة refers to the final abode.',
  };

  it('accepts a valid semantic data array', () => {
    const result = validateSemanticData([validEntry]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array input', () => {
    const result = validateSemanticData('not an array');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('array');
  });

  it('rejects an empty array', () => {
    const result = validateSemanticData([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('empty');
  });

  it('reports missing english field', () => {
    const data = [{ arabic: ['الله'], category: 'Theology', notes: 'note' }];
    const result = validateSemanticData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('semantic[0].english');
  });

  it('reports missing arabic field', () => {
    const data = [{ english: ['God'], category: 'Theology', notes: 'note' }];
    const result = validateSemanticData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('semantic[0].arabic');
  });

  it('reports missing english field', () => {
    const data = [{ arabic: ['الله'], category: 'Theology' }];
    const result = validateSemanticData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'semantic[0].english')).toBe(true);
  });

  it('reports non-string items in english array', () => {
    const data = [{ english: [42], arabic: ['الله'], category: 'Theology', notes: 'note' }];
    const result = validateSemanticData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('semantic[0].english');
  });

  it('handles null items in the array', () => {
    const result = validateSemanticData([null]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('object');
  });

  it('respects the error limit', () => {
    const bad = Array.from({ length: 100 }, () => ({}));
    const result = validateSemanticData(bad, 5);
    expect(result.errors.length).toBeLessThanOrEqual(5);
  });
});

// ─── formatSchemaErrors ────────────────────────────────────────────────────

describe('formatSchemaErrors', () => {
  it('returns success message when valid', () => {
    expect(formatSchemaErrors({ valid: true, errors: [] })).toContain('passed');
  });

  it('formats errors with numbered paths', () => {
    const result = {
      valid: false,
      errors: [
        { path: 'verses[0].gid', message: 'missing' },
        { path: 'verses[1].uthmani', message: 'wrong type' },
      ],
    };
    const formatted = formatSchemaErrors(result);
    expect(formatted).toContain('1.');
    expect(formatted).toContain('verses[0].gid');
    expect(formatted).toContain('2.');
  });
});
