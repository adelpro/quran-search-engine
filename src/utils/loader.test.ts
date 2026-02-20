import { describe, it, expect } from 'vitest';
import { loadQuranData, loadMorphology, loadWordMap } from './loader';
import fs from 'fs';

describe('Loader Functions', () => {
  // Add test case for corrupted/invalid JSON data
  it('should throw an error if JSON files are corrupted', async () => {
    // Temporarily rename the morphology.json file to simulate corrupted file
    const morphologyOriginalPath = __dirname + '/../data/morphology.json';
    const quranDataOriginalPath = __dirname + '/../data/quran.json';
    const wordMapOriginalPath = __dirname + '/../data/word-map.json';
    const morphologyBackupPath = morphologyOriginalPath + '.backup';
    const quranDataBackupPath = quranDataOriginalPath + '.backup';
    const wordMapBackupPath = wordMapOriginalPath + '.backup';

    try {
      // Backup the original file
      await fs.promises.copyFile(morphologyOriginalPath, morphologyBackupPath);
      await fs.promises.copyFile(quranDataOriginalPath, quranDataBackupPath);
      await fs.promises.copyFile(wordMapOriginalPath, wordMapBackupPath);

      // Write invalid JSON to the backup file
      await fs.promises.writeFile(morphologyBackupPath, 'This is not valid JSON');
      await fs.promises.writeFile(quranDataBackupPath, 'This is not valid JSON');
      await fs.promises.writeFile(wordMapBackupPath, 'This is not valid JSON');

      const morphology = await loadMorphology(morphologyBackupPath);
      const quranData = await loadQuranData(quranDataBackupPath);
      const wordMap = await loadWordMap(wordMapBackupPath);

      expect(morphology).toBeInstanceOf(Map);
      expect(quranData).toBeInstanceOf(Array);
      expect(wordMap).toBeInstanceOf(Object);
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
    } finally {
      // Delete the corrupted file
      await fs.promises.unlink(morphologyBackupPath);
      await fs.promises.unlink(quranDataBackupPath);
      await fs.promises.unlink(wordMapBackupPath);
    }
  });

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
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Could not load morphology data');
    } finally {
      // Restore the original file
      await fs.promises.rename(tempPath, originalPath);
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

  // Test case for missing word-map JSON file
  it('should throw an error if word-map.json is missing', async () => {
    // Temporarily rename the word-map.json file to simulate missing file
    const originalPath = __dirname + '/../data/word-map.json';
    const tempPath = __dirname + '/../data/word-map_temp.json';
    try {
      // Simulate missing file by renaming it
      await fs.promises.rename(originalPath, tempPath);

      const wordMap = await loadWordMap();
      expect(typeof wordMap).toBe('object');
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Could not load word map data');
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

    expect(Array.isArray(quranData)).toBe(true);
    expect(morphology).toBeInstanceOf(Map);
    expect(typeof wordMap).toBe('object');
  });
});
