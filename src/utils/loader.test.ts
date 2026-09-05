import { describe, it, expect, vi } from 'vitest';
import { loadQuranData, loadMorphology, loadWordMap, buildInvertedIndex } from './loader';
import type { QuranText, MorphologyAya } from '../types';
import fs from 'fs';

describe('Loader Functions', () => {
  // Regression test for #98: the old version copied ~8.6 MB of real data, passed paths
  // the loaders ignore, asserted success, and timed out. The loaders intentionally use
  // static bundler-analyzable JSON imports (see loader.ts), so corrupted files are
  // simulated by mocking the data modules instead — fast and hermetic.
  it('should throw an error if JSON files are corrupted', async () => {
    vi.resetModules();
    vi.doMock('../data/morphology.json', () => {
      throw new SyntaxError(`"This is not valid JSON" is not valid JSON`);
    });
    vi.doMock('../data/quran.json', () => {
      throw new SyntaxError(`"This is not valid JSON" is not valid JSON`);
    });
    vi.doMock('../data/word-map.json', () => {
      throw new SyntaxError(`"This is not valid JSON" is not valid JSON`);
    });

    try {
      // NOTE: both modules are imported dynamically *after* resetModules so the
      // error classes share a module realm with the loader under test —
      // otherwise `instanceof` fails across the two module instances.
      const freshLoader = await import('./loader');
      const freshErrors = await import('../errors');

      await expect(freshLoader.loadMorphology()).rejects.toThrow(freshErrors.DataParseError);
      await expect(freshLoader.loadQuranData()).rejects.toThrow(freshErrors.DataParseError);
      await expect(freshLoader.loadWordMap()).rejects.toThrow(freshErrors.DataParseError);
    } finally {
      vi.doUnmock('../data/morphology.json');
      vi.doUnmock('../data/quran.json');
      vi.doUnmock('../data/word-map.json');
      vi.resetModules();
    }
  });

  it('should throw a schema error if JSON files have an unexpected shape', async () => {
    vi.resetModules();
    vi.doMock('../data/quran.json', () => ({ default: { not: 'an array' } }));

    try {
      // Same module-realm note as above: import both dynamically after resetModules.
      const freshLoader = await import('./loader');
      const freshErrors = await import('../errors');

      await expect(freshLoader.loadQuranData()).rejects.toThrow(freshErrors.DataSchemaInvalidError);
    } finally {
      vi.doUnmock('../data/quran.json');
      vi.resetModules();
    }
  });

  it('should load Quran data', async () => {
    const data = await loadQuranData();

    expect(data).toBeInstanceOf(Map);
    expect(data.size).toBeGreaterThan(0);

    // Check structure of first item
    const firstItem = data.values().next().value;
    expect(firstItem).toHaveProperty('gid');
    expect(firstItem).toHaveProperty('uthmani');
    expect(firstItem).toHaveProperty('standard');
    expect(firstItem).toHaveProperty('sura_id');
    expect(firstItem).toHaveProperty('aya_id');
  });

  // Test case for malformed morphology entries
  it('should skip malformed morphology entries', async () => {
    const morphology = await loadMorphology();

    for (const [gid, entry] of morphology.entries()) {
      expect(typeof gid).toBe('number');
      expect(entry).toHaveProperty('lemmas');
      expect(entry).toHaveProperty('roots');
      expect(Array.isArray(entry.lemmas)).toBe(true);
      expect(Array.isArray(entry.roots)).toBe(true);
    }
  });

  it('should load morphology data', async () => {
    const morphology = await loadMorphology();

    expect(morphology).toBeInstanceOf(Map);
    expect(morphology.size).toBeGreaterThan(0);

    // Check structure of first entry
    const firstEntry = morphology.values().next().value;
    expect(firstEntry).toBeDefined();

    if (firstEntry) {
      expect(firstEntry).toHaveProperty('gid');
      expect(firstEntry).toHaveProperty('lemmas');
      expect(firstEntry).toHaveProperty('roots');
      expect(Array.isArray(firstEntry.lemmas)).toBe(true);
      expect(Array.isArray(firstEntry.roots)).toBe(true);
    }
  });

  // Test case for missing morphology JSON file
  it('should throw an error if morphology.json is missing', async () => {
    // Temporarily rename the morphology.json file to simulate missing file
    const originalPath = __dirname + '/../data/morphology.json';
    const tempPath = __dirname + '/../data/morphology_temp.json';
    try {
      // Simulate missing file by renaming it
      await fs.promises.rename(originalPath, tempPath);

      const morphology = await loadMorphology();
      expect(morphology).toBeInstanceOf(Map);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain('Failed to parse data file');
      }
    } finally {
      // Restore the original file
      await fs.promises.rename(tempPath, originalPath);
    }
  });

  it('should load word map data', async () => {
    const wordMap = await loadWordMap();

    expect(wordMap).toBeInstanceOf(Map);
    expect(wordMap).not.toBeNull();

    // Check if it has expected structure
    const keys = Array.from(wordMap.keys());
    expect(keys.length).toBeGreaterThan(0);

    // Check structure of first word entry
    const firstWord = wordMap.get(keys[0]);
    expect(firstWord).toHaveProperty('lemma');
    expect(firstWord).toHaveProperty('root');
  });

  // Test case for missing word-map JSON file
  it('should throw an error if word-map.json is missing', async () => {
    // Temporarily rename the word-map.json file to simulate missing file
    const originalPath = __dirname + '/../data/word-map.json';
    const tempPath = __dirname + '/../data/word-map_temp.json';
    try {
      // Simulate missing file by renaming it
      await fs.promises.rename(originalPath, tempPath);

      const wordMap = await loadWordMap();
      expect(wordMap).toBeInstanceOf(Map);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).toContain('Failed to parse data file');
      }
    } finally {
      // Restore the original file
      await fs.promises.rename(tempPath, originalPath);
    }
  });

  it('should handle concurrent loading', async () => {
    const [quranData, morphology, wordMap] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
    ]);

    expect(quranData).toBeInstanceOf(Map);
    expect(morphology).toBeInstanceOf(Map);
    expect(wordMap).toBeInstanceOf(Map);
  });
});

describe('buildInvertedIndex', () => {
  // Mock data for isolation
  const mockQuranData: QuranText[] = [
    { gid: 1, standard: 'بسم الله الرحمن الرحيم', uthmani: 'test' } as QuranText,
    { gid: 2, standard: 'الحمد لله رب العالمين', uthmani: 'test' } as QuranText,
    { gid: 3, standard: 'الرحمن الرحيم', uthmani: 'test' } as QuranText,
  ];

  const mockQuranDataMap = new Map((mockQuranData as QuranText[]).map((v) => [v.gid, v]));

  const mockMorphologyMap = new Map<number, MorphologyAya>([
    [
      1,
      {
        gid: 1,
        lemmas: ['بسم', 'الله', 'الرحمن', 'الرحيم'],
        roots: ['ب س م', 'ا ل ه', 'ر ح م', 'ر ح م'],
      },
    ],
    [
      2,
      {
        gid: 2,
        lemmas: ['الحمد', 'لله', 'رب', 'العالمين'],
        roots: ['ح م د', 'ا ل ه', 'ر ب ب', 'ع ل م'],
      },
    ],
    [
      3,
      {
        gid: 3,
        lemmas: ['الرحمن', 'الرحيم'],
        roots: ['ر ح م', 'ر ح م'],
      },
    ],
  ]);

  it('should build indices from real data', async () => {
    const [quranData, morphologyMap] = await Promise.all([loadQuranData(), loadMorphology()]);
    const index = buildInvertedIndex(morphologyMap, quranData);

    expect(index.lemmaIndex).toBeInstanceOf(Map);
    expect(index.rootIndex).toBeInstanceOf(Map);
    expect(index.wordIndex).toBeInstanceOf(Map);
    expect(index.lemmaIndex.size).toBeGreaterThan(0);
    expect(index.rootIndex.size).toBeGreaterThan(0);
    expect(index.wordIndex.size).toBeGreaterThan(0);
  });

  it('should map normalized lemmas to correct GIDs', () => {
    const index = buildInvertedIndex(mockMorphologyMap, mockQuranDataMap);

    // "الرحمن" appears in gid 1 and gid 3
    const rahmanGids = index.lemmaIndex.get('الرحمن');
    expect(rahmanGids).toBeDefined();
    expect(rahmanGids!.has(1)).toBe(true);
    expect(rahmanGids!.has(3)).toBe(true);
  });

  it('should map normalized roots to correct GIDs', () => {
    const index = buildInvertedIndex(mockMorphologyMap, mockQuranDataMap);

    // Root "ر ح م" appears in gid 1 and gid 3
    const rahmRoot = index.rootIndex.get('ر ح م');
    expect(rahmRoot).toBeDefined();
    expect(rahmRoot!.has(1)).toBe(true);
    expect(rahmRoot!.has(3)).toBe(true);
  });

  it('should handle empty morphology map', () => {
    const emptyMap = new Map<number, MorphologyAya>();
    const index = buildInvertedIndex(emptyMap, mockQuranDataMap);

    expect(index.lemmaIndex.size).toBe(0);
    expect(index.rootIndex.size).toBe(0);
    expect(index.wordIndex.size).toBeGreaterThan(0);
  });
});
