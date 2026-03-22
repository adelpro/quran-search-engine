import { describe, it, expect } from 'vitest';
import { buildPhoneticMap, getPhoneticFuse } from './phonetic';
import { search } from '../core/search';
import { loadMorphology, loadWordMap, loadQuranData } from './loader';
import type { QuranText, MorphologyAya } from '../types';
describe('Phonetic Utility', () => {
  it('should build a phonetic map from data', () => {
    const map = buildPhoneticMap();
    expect(map.size).toBeGreaterThan(0);
    // Spot check "bismi"
    expect(map.has('bismi')).toBe(true);
    expect(map.get('bismi')).toContain('بسم');
  });

  it('should provide a Fuse instance for phonetic keys', () => {
    const fuse = getPhoneticFuse();
    expect(fuse).toBeDefined();
    const results = fuse.search('bismii'); // typo
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item).toBe('bismi');
  });
});

describe('Phonetic Search Integration', () => {
  // We need real data or good mock data for these
  let mockQuranData: Map<number, QuranText>;
  let mockMorphologyMap: Map<number, MorphologyAya>;
  let mockWordMap: Map<string, { lemma?: string; root?: string }>;
  let mockPhoneticMap: Map<string, string[]>;

  it('should support phonetic search for English words', async () => {
    mockQuranData = await loadQuranData();
    mockMorphologyMap = await loadMorphology();
    mockWordMap = await loadWordMap();
    mockPhoneticMap = buildPhoneticMap();

    // "bismi" -> "بسم", "allahi" -> "الله"
    const result = search('bismi allahi', {
      quranData: mockQuranData,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMap,
      phoneticMap: mockPhoneticMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(1);
    expect(result.results[0].matchType).toBe('exact');
  });

  it('should support fuzzy phonetic search with typos', async () => {
    if (!mockQuranData) mockQuranData = await loadQuranData();
    if (!mockMorphologyMap) mockMorphologyMap = await loadMorphology();
    if (!mockWordMap) mockWordMap = await loadWordMap();
    if (!mockPhoneticMap) mockPhoneticMap = buildPhoneticMap();

    // "bismii" (extra 'i') should match "bismi"
    const result = search('bismii', {
      quranData: mockQuranData,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMap,
      phoneticMap: mockPhoneticMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(1);
  });

  it('should support mixed phonetic and Arabic queries', async () => {
    if (!mockQuranData) mockQuranData = await loadQuranData();
    if (!mockMorphologyMap) mockMorphologyMap = await loadMorphology();
    if (!mockWordMap) mockWordMap = await loadWordMap();
    if (!mockPhoneticMap) mockPhoneticMap = buildPhoneticMap();

    // "bismi الرحمن"
    const result = search('bismi الرحمن', {
      quranData: mockQuranData,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMap,
      phoneticMap: mockPhoneticMap,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].gid).toBe(1);
  });
});
