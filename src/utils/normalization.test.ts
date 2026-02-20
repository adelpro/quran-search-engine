import { describe, it, expect } from 'vitest';
import { removeTashkeel, normalizeArabic, isArabic } from './normalization';

describe('Normalization Utils', () => {
  describe('removeTashkeel', () => {
    it('should remove basic tashkeel', () => {
      const input = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
      // Expected: بسم الله الرحمن الرحيم
      // Note: ٱ (Wasl alef) is replaced by regular alef \u0627 in removeTashkeel logic line 9?
      // Wait, let's check the code: .replace(/\u0671/g, '\u0627')
      // So ٱ becomes ا
      // And tashkeel are removed.

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
      // Fatha, Damma, Kasra, Sukun, Shadda, Tanween
      const input = 'فَتْحَةٌ ضَمَّةٌ كَسْرَةٌ';
      const expected = 'فتحة ضمة كسرة';
      expect(removeTashkeel(input)).toBe(expected);
    });
  });

  describe('normalizeArabic', () => {
    it('should normalize alef variants to bare alef', () => {
      const input = 'أإآٱ';
      expect(normalizeArabic(input)).toBe('اااا');
    });

    it('should normalize hamza variants to standalone hamza', () => {
      // Based on code: .replace(/[ؤئء]/g, 'ء')
      const input = 'ؤئ';
      expect(normalizeArabic(input)).toBe('ءء');
    });

    it('should normalize alif maqsura to ya', () => {
      // Based on code: .replace(/ى/g, 'ي')
      const input = 'موسى';
      expect(normalizeArabic(input)).toBe('موسي');
    });

    it('should remove tatweel', () => {
      const input = 'بـــســـم';
      expect(normalizeArabic(input)).toBe('بسم');
    });

    it('should handle complex mixed text', () => {
      const input = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
      // removeTashkeel -> الحمد لله رب العالمين
      // normalize -> الحمد لله رب العالمين (assuming standard alefs)
      expect(normalizeArabic(input)).toBe('الحمد لله رب العالمين');
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
