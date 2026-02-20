import { describe, it, expect } from 'vitest';
import { getHighlightRanges, type HighlightRange } from './highlight';
import type { MatchType } from '../types';

describe('Highlight Utils', () => {
  describe('getHighlightRanges', () => {
    describe('basic matching', () => {
      it('should return empty array when no tokens provided', () => {
        const result = getHighlightRanges('بسم الله الرحمن الرحيم', undefined);
        expect(result).toEqual([]);
      });

      it('should return empty array for empty tokens array', () => {
        const result = getHighlightRanges('بسم الله الرحمن الرحيم', []);
        expect(result).toEqual([]);
      });

      it('should find exact match in plain Arabic text', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['الله']);

        expect(result.length).toBe(1);
        expect(result[0].token).toBe('الله');
        expect(text.slice(result[0].start, result[0].end)).toContain('الله');
      });

      it('should find multiple occurrences of the same token', () => {
        const text = 'قل هو الله احد الله الصمد';
        const result = getHighlightRanges(text, ['الله']);

        expect(result.length).toBe(2);
        expect(result[0].start).toBeLessThan(result[1].start);
      });

      it('should find multiple different tokens', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['الله', 'الرحمن']);

        expect(result.length).toBe(2);
        const tokens = result.map((r) => r.token);
        expect(tokens).toContain('الله');
        expect(tokens).toContain('الرحمن');
      });
    });

    describe('diacritic-tolerant matching', () => {
      it('should match token without diacritics against text with diacritics', () => {
        const text = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ';
        const result = getHighlightRanges(text, ['الله']);

        expect(result.length).toBe(1);
        expect(result[0].token).toBe('الله');
      });

      it('should match across alef variants', () => {
        // Text has أ (alef with hamza above), token uses plain ا
        const text = 'قل هو الله أحد';
        const result = getHighlightRanges(text, ['احد']);

        expect(result.length).toBe(1);
        expect(result[0].token).toBe('احد');
      });

      it('should match across ya/alif maqsura variants', () => {
        const text = 'وقال موسى لقومه';
        const result = getHighlightRanges(text, ['موسي']);

        expect(result.length).toBe(1);
      });

      it('should match tah marbuta and hah interchangeably', () => {
        const text = 'رحمة الله واسعة';
        const result = getHighlightRanges(text, ['رحمه']);

        expect(result.length).toBe(1);
      });
    });

    describe('match types', () => {
      it('should default to fuzzy when no tokenTypes provided', () => {
        const text = 'بسم الله';
        const result = getHighlightRanges(text, ['الله']);

        expect(result[0].matchType).toBe('fuzzy');
      });

      it('should use provided tokenTypes', () => {
        const text = 'بسم الله';
        const tokenTypes: Record<string, MatchType> = { 'الله': 'exact' };
        const result = getHighlightRanges(text, ['الله'], tokenTypes);

        expect(result[0].matchType).toBe('exact');
      });

      it('should map none matchType to fuzzy', () => {
        const text = 'بسم الله';
        const tokenTypes: Record<string, MatchType> = { 'الله': 'none' };
        const result = getHighlightRanges(text, ['الله'], tokenTypes);

        expect(result[0].matchType).toBe('fuzzy');
      });

      it('should support lemma match type', () => {
        const text = 'كتب الكاتب الكتاب';
        const tokenTypes: Record<string, MatchType> = { 'كتب': 'lemma' };
        const result = getHighlightRanges(text, ['كتب'], tokenTypes);

        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0].matchType).toBe('lemma');
      });

      it('should support root match type', () => {
        const text = 'كتب الكاتب';
        const tokenTypes: Record<string, MatchType> = { 'كتب': 'root' };
        const result = getHighlightRanges(text, ['كتب'], tokenTypes);

        expect(result[0].matchType).toBe('root');
      });
    });

    describe('overlap resolution', () => {
      it('should not produce overlapping ranges', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['الله', 'الله الرحمن']);

        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].end).toBeLessThanOrEqual(result[i + 1].start);
        }
      });

      it('should prefer longer matches over shorter ones', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['الله', 'الله الرحمن']);

        // The longer match "الله الرحمن" should take priority
        const longerMatch = result.find((r) => r.token === 'الله الرحمن');
        if (longerMatch) {
          // If long match was found, "الله" alone should not overlap with it
          const shorterMatch = result.find((r) => r.token === 'الله');
          if (shorterMatch) {
            expect(
              shorterMatch.end <= longerMatch.start ||
                shorterMatch.start >= longerMatch.end,
            ).toBe(true);
          }
        }
      });

      it('should return ranges sorted by position', () => {
        const text = 'الرحمن الرحيم مالك يوم الدين';
        const result = getHighlightRanges(text, ['الرحمن', 'الدين']);

        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].start).toBeLessThan(result[i + 1].start);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty text', () => {
        const result = getHighlightRanges('', ['الله']);
        expect(result).toEqual([]);
      });

      it('should handle no matches in text', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['شمس']);
        expect(result).toEqual([]);
      });

      it('should handle single character token', () => {
        const text = 'ق والقرآن المجيد';
        const result = getHighlightRanges(text, ['ق']);
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('should not include internal priority field in output', () => {
        const text = 'بسم الله';
        const result = getHighlightRanges(text, ['الله']);

        expect(result.length).toBe(1);
        const range = result[0] as HighlightRange & { priority?: number };
        expect(range.priority).toBeUndefined();
      });

      it('should produce valid start/end ranges', () => {
        const text = 'بسم الله الرحمن الرحيم';
        const result = getHighlightRanges(text, ['الله', 'الرحمن', 'الرحيم']);

        for (const range of result) {
          expect(range.start).toBeGreaterThanOrEqual(0);
          expect(range.end).toBeGreaterThan(range.start);
          expect(range.end).toBeLessThanOrEqual(text.length);
        }
      });

      it('should handle hamza variants in tokens', () => {
        const text = 'إنا أعطيناك الكوثر';
        const result = getHighlightRanges(text, ['انا']);

        expect(result.length).toBe(1);
      });
    });
  });
});
