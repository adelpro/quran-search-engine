import { describe, it, expect } from 'vitest';
import { computeScore } from './scoring';
import type { MorphologyAya, QuranText, WordMap } from '../types';

const verse = {
  gid: 1,
  uthmani: 'ذلك الكتاب',
  standard: 'ذلك الكتاب',
  sura_id: 1,
  aya_id: 1,
  aya_id_display: '1',
  page_id: 1,
  juz_id: 1,
  standard_full: 'ذلك الكتاب',
  sura_name: 'الفاتحة',
  sura_name_en: 'The Opening',
  sura_name_romanization: 'Al-Fatihah',
} as QuranText;

const morphologyMap = new Map<number, MorphologyAya>([
  [1, { gid: 1, lemmas: ['ذلك', 'كتب'], roots: ['ك-ت-ب'] }],
]);

const wordMap: WordMap = new Map([
  ['كتب', { lemma: 'كتب', root: 'ك-ت-ب' }],
  ['الكتاب', { lemma: 'كتب', root: 'ك-ت-ب' }],
]);

describe('computeScore with a Map word map', () => {
  it('scores a lemma-only match instead of leaving it unscored', () => {
    const result = computeScore(verse, 'كتب', morphologyMap, wordMap, {
      lemma: true,
      root: false,
    });

    expect(result.matchType).toBe('lemma');
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.matchedTokens.length).toBeGreaterThan(0);
  });

  it('scores a root-only match instead of leaving it unscored', () => {
    const result = computeScore(verse, 'كتب', morphologyMap, wordMap, {
      lemma: false,
      root: true,
    });

    expect(result.matchType).toBe('root');
    expect(result.matchScore).toBeGreaterThan(0);
  });

  it('still scores an exact text match as exact', () => {
    const result = computeScore(verse, 'الكتاب', morphologyMap, wordMap, {
      lemma: true,
      root: true,
    });

    expect(result.matchType).toBe('exact');
  });

  it('lets a later exact match override an earlier lemma match', () => {
    // "كتب" matches by lemma, then "الكتاب" matches the verse text exactly.
    // Exact must win regardless of token order.
    const result = computeScore(verse, 'كتب الكتاب', morphologyMap, wordMap, {
      lemma: true,
      root: false,
    });

    expect(result.matchType).toBe('exact');
  });

  it('lets a later exact match override an earlier root match', () => {
    const result = computeScore(verse, 'كتب الكتاب', morphologyMap, wordMap, {
      lemma: false,
      root: true,
    });

    expect(result.matchType).toBe('exact');
  });

  it('passes wordMap to the lemma lookup so matched tokens are verse words', () => {
    const result = computeScore(verse, 'كتب', morphologyMap, wordMap, {
      lemma: true,
      root: false,
    });

    // Without wordMap the fallback returns the lemma itself ("كتب"); with it,
    // the actual verse word ("الكتاب") is returned for highlighting.
    expect(result.matchedTokens).toContain('الكتاب');
    expect(result.matchedTokens).not.toContain('كتب');
    expect(result.tokenTypes['الكتاب']).toBe('lemma');
  });
});
