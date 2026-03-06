import { readFileSync, writeFileSync } from 'fs';
import { normalizeArabic } from '../src';

interface DictionaryEntry {
  english: string;
  arabic: Set<string>;
  synonyms: Set<string>;
  debug: { key: string; wordText: string }[];
}

interface Aya {
  sura_id: number;
  aya_id: number;
  aya_id_display: string;
  uthmani: string;
  gid: number;
  page_id: number;
  juz_id: number;
  standard: string;
  standard_full: string;
  sura_name: string;
  sura_name_en: string;
  sura_name_romanization: string;
}

type AyaMap = Record<string, Aya>;

function extractVisibleWords(text: string): string {
  const regex = /<span[^>]*>(.*?)<\/span>|([^<]+)/g;
  const parts = [...text.matchAll(regex)].map((m) => (m[1] || m[2]).trim());
  return parts.join(' ').trim();
}

function removeParentheticals(word: string): string {
  return word.replace(/\([^)]*\)\s*/g, '').trim();
}

function arrayToMap(arr: Aya[]): AyaMap {
  const out: AyaMap = {};
  for (const item of arr) {
    const key = `${item.sura_id}:${item.aya_id}`;
    out[key] = item;
  }
  return out;
}

function getWordFromQuran(key: string, quran: AyaMap): string {
  const [surahId, verseId, wordId] = key.split(':');
  const wordIndex = parseInt(wordId);
  const verseWords = quran[`${surahId}:${verseId}`].standard.split(' ');

  if (verseWords.length >= wordIndex && wordIndex > 0) {
    return verseWords[wordIndex - 1];
  } else {
    console.log('miss alignment at key less words:', key);
    return 'miss alignment';
  }
}

function applySplitFixes(quran: AyaMap, fixes: { key: string; splitsWords: string[] }[]) {
  for (const { key, splitsWords } of fixes) {
    const [surahId, verseId, wordId] = key.split(':');
    const wordIndex = parseInt(wordId);
    const verseWords = quran[`${surahId}:${verseId}`].standard.split(' ');

    const newVerse: string[] = verseWords.slice(0, wordIndex - 1);
    newVerse.push(...splitsWords);
    newVerse.push(...verseWords.slice(wordIndex));

    quran[`${surahId}:${verseId}`].standard = newVerse.join(' ');
  }
}

function applyMergeFixes(quran: AyaMap, keys: string[]) {
  for (const key of keys) {
    const [surahId, verseId, wordId] = key.split(':');
    const wordIndex = parseInt(wordId);

    const verseWords = quran[`${surahId}:${verseId}`].standard.split(' ');
    verseWords[wordIndex - 1] += verseWords[wordIndex];
    verseWords.splice(wordIndex, 1);

    const joined = verseWords.join(' ');
    quran[`${surahId}:${verseId}`].standard = joined;
  }
}

function attemptAutoMergeFixes(quran: AyaMap, key: string) {
  const [surahId, verseId] = key.split(':');
  const verseWords = quran[`${surahId}:${verseId}`].standard.split(' ');
  const tryToFixList: string[] = ['يا', 'ها', 'ويا'];

  for (const token of tryToFixList) {
    if (verseWords.includes(token)) {
      applyMergeFixes(quran, [key + `:${verseWords.indexOf(token) + 1}`]);
    }
  }
}

function validateLengths(quran: AyaMap, parsed: Record<string, any>, tryToFix: boolean) {
  const maxWordsPerAya: Record<string, number> = {};

  for (const [key] of Object.entries(parsed)) {
    const [surahId, verseId, wordId] = key.split(':');
    const wordIndex = parseInt(wordId);
    const ayaKey = `${surahId}:${verseId}`;

    if (ayaKey in maxWordsPerAya) {
      maxWordsPerAya[ayaKey] = Math.max(maxWordsPerAya[ayaKey], wordIndex);
    } else {
      maxWordsPerAya[ayaKey] = wordIndex;
    }
  }

  for (const [ayaKey, expectedCount] of Object.entries(maxWordsPerAya)) {
    const [surahId, verseId] = ayaKey.split(':');
    const verseWords = quran[`${surahId}:${verseId}`].standard.split(' ');
    if (verseWords.length != expectedCount) {
      if (tryToFix) attemptAutoMergeFixes(quran, ayaKey);
      else console.log(`warning possible misalignment check this key: ${ayaKey}`);
    }
  }
}

function main() {
  const raw = readFileSync('colored-english-wbw-translation.json', 'utf8');
  const sourceData: Record<string, any> = JSON.parse(raw);
  const dictMap: Record<string, DictionaryEntry> = {};

  const quran: AyaMap = arrayToMap(JSON.parse(readFileSync('../src/data/quran.json', 'utf8')));

  const splitFixes: { key: string; splitsWords: string[] }[] = [
    { key: '37:130:3', splitsWords: ['إلياسين'] },
  ];
  applySplitFixes(quran, splitFixes);

  const mergeFixKeys: string[] = [
    '20:94:2',
    '20:94:2',
    '72:16:1',
    '28:38:3',
    '28:38:3',
    '37:102:6',
  ];
  applyMergeFixes(quran, mergeFixKeys);

  validateLengths(quran, sourceData, true);
  validateLengths(quran, sourceData, false);

  for (const [key, value] of Object.entries(sourceData)) {
    const rawWord = extractVisibleWords(<string>value);
    const cleaned = removeParentheticals(rawWord);

    if (!(cleaned in dictMap)) {
      dictMap[cleaned] = {
        english: cleaned,
        arabic: new Set<string>(),
        synonyms: new Set<string>(),
        debug: [],
      };
    }

    const qWord = getWordFromQuran(key, quran);
    dictMap[cleaned].arabic.add(qWord);

    // parsedDataset[cleaned].synonyms.add('synonymsValue');

    dictMap[cleaned].debug.push({
      key,
      wordText: qWord,
    });
  }

  const output = Object.values(dictMap).map((entry) => ({
    english: entry.english,
    arabic: Array.from(entry.arabic),
    synonyms: Array.from(entry.synonyms),
    // debug: entry.debug,
  }));

  writeFileSync('english-arabic-dictionary.json', JSON.stringify(output, null, 2));
}

main();
