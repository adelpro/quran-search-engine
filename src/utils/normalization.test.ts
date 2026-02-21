import { describe, it, expect } from 'vitest';
import { removeTashkeel, normalizeArabic, isArabic } from './normalization';

describe('Normalization Utils', () => {
  describe('removeTashkeel', () => {
    it('should remove basic tashkeel', () => {
      const input = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
      const expected = 'بسم الله الرحمن الرحيم';
      expect(removeTashkeel(input)).toBe(expected);
    });

    it('should handle text without tashkeel', () => {
      const input = 'الحمد لله';
      expect(removeTashkeel(input)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(removeTashkeel('')).toBe('');
    });

    it('should remove various diacritics', () => {
      const input = 'فَتْحَةٌ ضَمَّةٌ كَسْرَةٌ';
      const expected = 'فتحة ضمة كسرة';
      expect(removeTashkeel(input)).toBe(expected);
    });

    it('should handle string with only spaces', () => {
      expect(removeTashkeel('   ')).toBe('   ');
    });

    it('should handle string with only tashkeel characters', () => {
      // All tashkeel should be removed, leaving empty string
      const input = '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652';
      expect(removeTashkeel(input)).toBe('');
    });

    it('should handle mixed Arabic and Latin characters', () => {
      const input = 'Hello بِسْمِ World';
      expect(removeTashkeel(input)).toBe('Hello بسم World');
    });

    it('should handle strings with numbers', () => {
      const input = 'آية 42 مِنْ سورة البقرة';
      expect(removeTashkeel(input)).toBe('آية 42 من سورة البقرة');
    });

    it('should handle consecutive diacritics', () => {
      // Shadda + Fatha on same letter
      const input = 'رَبَّنَا';
      expect(removeTashkeel(input)).toBe('ربنا');
    });

    it('should replace Wasl alef with regular alef', () => {
      const input = 'ٱلْحَمْدُ';
      expect(removeTashkeel(input)).toBe('الحمد');
    });

    it('should handle Quranic annotation marks', () => {
      // U+06D6-U+06DC range (Quranic signs)
      const input = 'كلمة\u06D6\u06D7';
      expect(removeTashkeel(input)).toBe('كلمة');
    });
  });

  describe('normalizeArabic', () => {
    it('should normalize alef variants to bare alef', () => {
      const input = 'أإآٱ';
      expect(normalizeArabic(input)).toBe('اااا');
    });

    it('should normalize hamza variants to standalone hamza', () => {
      const input = 'ؤئ';
      expect(normalizeArabic(input)).toBe('ءء');
    });

    it('should normalize alif maqsura to ya', () => {
      const input = 'موسى';
      expect(normalizeArabic(input)).toBe('موسي');
    });

    it('should remove tatweel', () => {
      const input = 'بـــســـم';
      expect(normalizeArabic(input)).toBe('بسم');
    });

    it('should handle complex mixed text', () => {
      const input = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
      expect(normalizeArabic(input)).toBe('الحمد لله رب العالمين');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeArabic('')).toBe('');
    });

    it('should return empty string for null-ish input', () => {
      expect(normalizeArabic(undefined as unknown as string)).toBe('');
      expect(normalizeArabic(null as unknown as string)).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(normalizeArabic('   ')).toBe('');
    });

    it('should strip non-Arabic characters', () => {
      const input = 'Hello بسم World 123';
      expect(normalizeArabic(input)).toBe('بسم');
    });

    it('should collapse multiple spaces into single space', () => {
      const input = 'بسم    الله    الرحمن';
      expect(normalizeArabic(input)).toBe('بسم الله الرحمن');
    });

    it('should handle CRLF and newlines', () => {
      const input = 'بسم\r\nالله\nالرحمن';
      expect(normalizeArabic(input)).toBe('بسم الله الرحمن');
    });

    it('should handle strings with numbers (stripped)', () => {
      const input = 'سورة 2 البقرة';
      // Numbers are non-Arabic and should be stripped
      expect(normalizeArabic(input)).toBe('سورة البقرة');
    });

    it('should handle special characters and punctuation', () => {
      const input = 'بسم الله، الرحمن! الرحيم.';
      expect(normalizeArabic(input)).toBe('بسم الله الرحمن الرحيم');
    });

    it('should handle text with only diacritics', () => {
      const input = '\u064B\u064C\u064D\u064E';
      expect(normalizeArabic(input)).toBe('');
    });

    it('should handle long text performance', () => {
      const base = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ';
      const longInput = base.repeat(1000);
      const start = performance.now();
      const result = normalizeArabic(longInput);
      const duration = performance.now() - start;

      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should preserve hyphens within Arabic text', () => {
      // Regex allows \s and - explicitly: /[^\u0621-\u064A\s-]+/g
      const input = 'بسم-الله';
      expect(normalizeArabic(input)).toBe('بسم-الله');
    });

    it('should handle mixed alef variants in a real word', () => {
      // إبراهيم with hamza-below alef → ابراهيم
      const input = 'إبراهيم';
      expect(normalizeArabic(input)).toBe('ابراهيم');
    });

    it('should handle tah marbuta (not normalized)', () => {
      // tah marbuta (ة) is within the Arabic range and should be preserved
      const input = 'رحمة';
      expect(normalizeArabic(input)).toBe('رحمة');
    });
  });

  describe('isArabic', () => {
    it('Should return true for Arabic text', () => {
      const input = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
      expect(isArabic(input)).toBe(true);
    });

    it('Should return false for non-Arabic text', () => {
      const input = 'Hello World';
      expect(isArabic(input)).toBe(false);
    });
  });
});
