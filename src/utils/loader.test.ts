import { describe, it, expect } from 'vitest';
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  buildInvertedIndex,
  loadInvertedIndex,
} from './loader';

describe('Loader Functions', () => {
  it('should load Quran data', async () => {
    const data = await loadQuranData();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Check structure of first item
    const firstItem = data[0];
    expect(firstItem).toHaveProperty('gid');
    expect(firstItem).toHaveProperty('uthmani');
    expect(firstItem).toHaveProperty('standard');
    expect(firstItem).toHaveProperty('sura_id');
    expect(firstItem).toHaveProperty('aya_id');
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

  it('should load word map data', async () => {
    const wordMap = await loadWordMap();

    expect(typeof wordMap).toBe('object');
    expect(wordMap).not.toBeNull();

    // Check if it has expected structure
    const keys = Object.keys(wordMap);
    expect(keys.length).toBeGreaterThan(0);

    // Check structure of first word entry
    const firstWord = wordMap[keys[0]];
    expect(firstWord).toHaveProperty('lemma');
    expect(firstWord).toHaveProperty('root');
  });

  it('should handle concurrent loading', async () => {
    const [quranData, morphology, wordMap] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
    ]);

    expect(Array.isArray(quranData)).toBe(true);
    expect(morphology).toBeInstanceOf(Map);
    expect(typeof wordMap).toBe('object');
  });
});

describe('buildInvertedIndex', () => {
  it('should build indices from real data', async () => {
    const [morphologyMap, wordMap, quranData] = await Promise.all([
      loadMorphology(),
      loadWordMap(),
      loadQuranData(),
    ]);
    const index = buildInvertedIndex(morphologyMap, quranData);

    expect(index.lemmaIndex).toBeInstanceOf(Map);
    expect(index.rootIndex).toBeInstanceOf(Map);
    expect(index.wordIndex).toBeInstanceOf(Map);
    expect(index.lemmaIndex.size).toBeGreaterThan(0);
    expect(index.rootIndex.size).toBeGreaterThan(0);
    expect(index.wordIndex.size).toBeGreaterThan(0);
  });

  it('should have GID sets as values', async () => {
    const [morphologyMap, wordMap, quranData] = await Promise.all([
      loadMorphology(),
      loadWordMap(),
      loadQuranData(),
    ]);
    const index = buildInvertedIndex(morphologyMap, quranData);

    // Check a lemma entry has a Set of numbers
    const firstLemmaEntry = index.lemmaIndex.values().next().value;
    expect(firstLemmaEntry).toBeInstanceOf(Set);
    expect(firstLemmaEntry!.size).toBeGreaterThan(0);

    // Check a root entry has a Set of numbers
    const firstRootEntry = index.rootIndex.values().next().value;
    expect(firstRootEntry).toBeInstanceOf(Set);
    expect(firstRootEntry!.size).toBeGreaterThan(0);

    // Check a word entry has a Set of numbers
    const firstWordEntry = index.wordIndex.values().next().value;
    expect(firstWordEntry).toBeInstanceOf(Set);
    expect(firstWordEntry!.size).toBeGreaterThan(0);
  });
});

describe('loadInvertedIndex', () => {
  it('should load pre-built indices from JSON files', async () => {
    const index = await loadInvertedIndex();

    expect(index.lemmaIndex).toBeInstanceOf(Map);
    expect(index.rootIndex).toBeInstanceOf(Map);
    expect(index.lemmaIndex.size).toBeGreaterThan(0);
    expect(index.rootIndex.size).toBeGreaterThan(0);
  });

  it('should have Set<number> values matching buildInvertedIndex output', async () => {
    const [loaded, morphologyMap, wordMap, quranData] = await Promise.all([
      loadInvertedIndex(),
      loadMorphology(),
      loadWordMap(),
      loadQuranData(),
    ]);
    const built = buildInvertedIndex(morphologyMap, quranData);

    // Same number of entries
    expect(loaded.lemmaIndex.size).toBe(built.lemmaIndex.size);
    expect(loaded.rootIndex.size).toBe(built.rootIndex.size);
    expect(loaded.wordIndex.size).toBe(built.wordIndex.size);

    // Spot-check a few lemma entries match
    for (const [key, builtSet] of Array.from(built.lemmaIndex.entries()).slice(0, 5)) {
      const loadedSet = loaded.lemmaIndex.get(key);
      expect(loadedSet).toBeDefined();
      expect(loadedSet!.size).toBe(builtSet.size);
    }
  });
});
