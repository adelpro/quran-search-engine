import { describe, it, expect } from 'vitest';
import { transliterate, isLatinInput } from './transliteration';

describe('isLatinInput', () => {
  it('should return true for pure Latin text', () => {
    expect(isLatinInput('Bismillah')).toBe(true);
  });

  it('should return true for Latin text with spaces', () => {
    expect(isLatinInput('Al Rahman')).toBe(true);
  });

  it('should return false for Arabic text', () => {
    expect(isLatinInput('بسم الله')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isLatinInput('')).toBe(false);
  });

  it('should return false for mixed Arabic and Latin', () => {
    expect(isLatinInput('hello الله')).toBe(false);
  });

  it('should return true for Latin with hyphens', () => {
    expect(isLatinInput('Al-Fatihah')).toBe(true);
  });

  it('should return true for Latin with apostrophes', () => {
    expect(isLatinInput("Qur'an")).toBe(true);
  });
});

describe('transliterate', () => {
  it('should return empty string for empty input', () => {
    expect(transliterate('')).toBe('');
  });

  // Single letter mappings
  it('should transliterate basic consonants', () => {
    expect(transliterate('b')).toBe('ب');
    expect(transliterate('t')).toBe('ت');
    expect(transliterate('n')).toBe('ن');
    expect(transliterate('m')).toBe('م');
    expect(transliterate('l')).toBe('ل');
    expect(transliterate('r')).toBe('ر');
    expect(transliterate('s')).toBe('س');
    expect(transliterate('k')).toBe('ك');
    expect(transliterate('f')).toBe('ف');
    expect(transliterate('d')).toBe('د');
    expect(transliterate('w')).toBe('و');
    expect(transliterate('y')).toBe('ي');
    expect(transliterate('h')).toBe('ه');
    expect(transliterate('j')).toBe('ج');
    expect(transliterate('q')).toBe('ق');
    expect(transliterate('z')).toBe('ز');
  });

  // Multi-character digraph mappings
  it('should transliterate digraphs', () => {
    expect(transliterate('sh')).toBe('ش');
    expect(transliterate('th')).toBe('ث');
    expect(transliterate('kh')).toBe('خ');
    expect(transliterate('dh')).toBe('ذ');
    expect(transliterate('gh')).toBe('غ');
  });

  // Vowels
  it('should transliterate vowels', () => {
    expect(transliterate('a')).toBe('ا');
    expect(transliterate('i')).toBe('ي');
    expect(transliterate('u')).toBe('و');
  });

  // Common words
  it('should transliterate "Allah"', () => {
    const result = transliterate('Allah');
    expect(result).toBe('الله');
  });

  it('should transliterate "Bismillah"', () => {
    const result = transliterate('Bismillah');
    expect(result).toBe('بسمالله');
  });

  it('should transliterate "Rahman"', () => {
    const result = transliterate('Rahman');
    expect(result).toBe('رحمن');
  });

  it('should transliterate "Quran"', () => {
    const result = transliterate('Quran');
    expect(result).toBe('قران');
  });

  // Case insensitive
  it('should be case insensitive', () => {
    expect(transliterate('ALLAH')).toBe(transliterate('allah'));
    expect(transliterate('Rahman')).toBe(transliterate('rahman'));
  });

  // Spaces preserved
  it('should preserve spaces between words', () => {
    const result = transliterate('Al Rahman');
    expect(result).toContain(' ');
  });

  // Hyphens treated as separators
  it('should handle hyphens as word separators', () => {
    const result = transliterate('Al-Rahman');
    expect(result).toContain('رحمن');
  });

  // Emphatic consonants
  it('should transliterate emphatic consonants with capital letters', () => {
    expect(transliterate('S')).toBe('ص');
    expect(transliterate('D')).toBe('ض');
    expect(transliterate('T')).toBe('ط');
    expect(transliterate('Z')).toBe('ظ');
  });

  // Hamza and Ayn
  it('should transliterate hamza and ayn markers', () => {
    expect(transliterate("'")).toBe('ء');
  });

  // Multiple words
  it('should transliterate multiple words', () => {
    const result = transliterate('Al hamd');
    expect(result).toContain('حمد');
  });

  it('should handle double letters', () => {
    const result = transliterate('ll');
    expect(result).toBe('لل');
  });

  it('should handle "ee" as ي', () => {
    const result = transliterate('ee');
    expect(result).toBe('ي');
  });

  it('should handle "oo" as و', () => {
    const result = transliterate('oo');
    expect(result).toBe('و');
  });
});
