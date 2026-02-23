import { describe, it, expect } from 'vitest';
import { getHighlightRanges } from './highlight';
import type { MatchType } from '../types';

describe('getHighlightRanges', () => {
  // Basic guard: prevents errors if no tokens are passed.
  it('should return empty array for empty tokens', () => {
    const text = 'بسم الله الرحمن الرحيم';
    const tokens: string[] = [];
    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toEqual([]);
  });

  // Baseline check: ensures the regex works on simple text without diacritics.
  it('should find exact matches with no tashkeel', () => {
    const text = 'بسم الله الرحمن الرحيم';
    const tokens = ['الله'];
    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toHaveLength(1);
    expect(ranges[0].token).toBe('الله');
    expect(text.substring(ranges[0].start, ranges[0].end)).toBe('الله');
  });

  // Core requirement: The search token is plain Arabic, but the target text has Tashkeel.
  // The regex inside getHighlightRanges must match regardless of the diacritics.
  it('should find matches in text WITH tashkeel', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const tokens = ['الله']; // Normalized token

    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toHaveLength(1);
    const match = text.substring(ranges[0].start, ranges[0].end);

    // The extracted matched text will include the original tashkeel.
    expect(match).toContain('للَّهِ');
  });

  // Verifies the regex iterates over the whole string globally and doesn't stop.
  it('should find multiple non-overlapping matches', () => {
    const text = 'الرحمن الرحيم';
    const tokens = ['الرحمن', 'الرحيم'];
    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toHaveLength(2);
    expect(ranges[0].token).toBe('الرحمن');
    expect(ranges[1].token).toBe('الرحيم');
  });

  // Tests the normalization mapping inside createDiacriticRegex (e.g., 'ا' matches 'إ' and 'آ').
  it('should handle alef variants', () => {
    const text = 'إيمان آمن';
    const tokens = ['ايمان', 'امن']; // Plain 'alef'
    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toHaveLength(2);
    expect(text.substring(ranges[0].start, ranges[0].end)).toBe('إيمان');
    expect(text.substring(ranges[1].start, ranges[1].end)).toBe('آمن');
  });

  // Tests edge case: Overlapping matches.
  // If a short token ('مسلم') and a long token ('المسلمين') match the exact same target word,
  // the logic must pick the longer, more precise token ('المسلمين') instead of failing or picking the substring.
  it('should prioritize longer matches (if applicable) or maintain order', () => {
    const text = 'الْمُسْلِمِينَ';
    const tokens = ['مسلم', 'المسلمين'];
    const ranges = getHighlightRanges(text, tokens);

    // Ensure the more specific token is assigned to the highlight range
    expect(ranges).toHaveLength(1);
    expect(ranges[0].token).toBe('المسلمين');
  });

  // Tests how highlighting is handled when matched tokens exist in the text
  // but are separated by spaces or other non-matching words.
  // E.g., Text: "WordA WordB WordC", Search Tokens: ["WordA", "WordC"].
  //
  // It verifies two things:
  // 1. It finds all distinct matches anywhere in the string.
  // 2. Importantly, it ensures it returns EXACTLY 3 distinct HighlightRanges (objects with start/end).
  // It DOES NOT accidentally merge them into a single giant range from the start of "ما"
  // to the end of "الله", which would incorrectly highlight the spaces in between.
  it('should handle disconnected matches correctly', () => {
    const text = 'مَا شَاءَ ٱللَّهُ';
    const tokens = ['ما', 'شاء', 'الله'];
    const ranges = getHighlightRanges(text, tokens);

    expect(ranges).toHaveLength(3);
  });

  // Verifies that metadata passed from the main search engine (like 'lemma', 'root')
  // is successfully attached to the output ranges for the UI to style differently.
  it('should assign correct match types if provided', () => {
    const text = 'بسم الله';
    const tokens = ['بسم', 'الله'];
    const tokenTypes: Record<string, MatchType> = {
      بسم: 'exact',
      الله: 'lemma',
    };

    const ranges = getHighlightRanges(text, tokens, tokenTypes);

    const bismRange = ranges.find((r) => r.token === 'بسم');
    const allahRange = ranges.find((r) => r.token === 'الله');

    expect(bismRange?.matchType).toBe('exact');
    expect(allahRange?.matchType).toBe('lemma');
  });

  // Fallback behavior: if no token type is configured, it defaults to 'fuzzy'.
  it('should default match type to fuzzy if "none" or missing', () => {
    const text = 'بسم';
    const tokens = ['بسم'];
    const ranges = getHighlightRanges(text, tokens);
    expect(ranges[0].matchType).toBe('fuzzy');
  });
});
