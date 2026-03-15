import { readFileSync, writeFileSync } from 'fs';
import pLimit from 'p-limit';
import natural from 'natural';

const wordnet = new natural.WordNet();
const mappedNlpWords: Record<string, string> = {};

async function getTopSynonyms(word: string, limit = 5): Promise<string[]> {
  return new Promise((resolve) => {
    wordnet.lookup(word, (results) => {
      if (!results || results.length === 0) return resolve([]);

      const synonymsMap = new Map<string, number>();

      for (const result of results) {
        // heuristic: fewer pointers = more relevant
        const score = 1 / (result.ptrs.length + 1);
        for (const syn of result.synonyms) {
          const clean = syn.replace(/_/g, ' ');
          synonymsMap.set(clean, (synonymsMap.get(clean) || 0) + score);
        }
      }

      // remove original word, filter multi-word synonyms & sort by score
      const topSyns = Array.from(synonymsMap.entries())
        .filter(([syn]) => syn.toLowerCase() !== word.toLowerCase() && !syn.includes(' '))
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([syn]) => syn)
        .map((syn) => removeParentheticals(syn));

      console.log(`  top synonyms for "${word}":`, topSyns);
      resolve(topSyns);
    });
  });
}
function extractKeyword(sentence: string): string {
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(sentence);

  const terms = tfidf.listTerms(0);

  if (terms.length === 0) return '';

  return terms[0].term;
}

const nonMeaningfulSentences: Set<string> = new Set<string>();

async function normalizeEnglish(englishText: string): Promise<string> {
  const res = await extractKeyword(englishText.trim().toLowerCase());
  console.log(`original word: ${englishText} <===> normalized word: ${res}`);
  if (res == '') {
    nonMeaningfulSentences.add(englishText.trim().toLowerCase());
  } else {
    mappedNlpWords[englishText] = res;
  }
  return res;
}

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
  return word
    .replace(/\([^)]*\)\s*/g, '')
    .trim()
    .toLowerCase();
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

async function normalizeDatasetWithNlp(quran: Record<string, DictionaryEntry>) {
  const updatedQuran: Record<string, DictionaryEntry> = {};

  for (const key of Object.keys(quran)) {
    const normlizedKey = await normalizeEnglish(key);

    if (!(normlizedKey in updatedQuran)) {
      updatedQuran[normlizedKey] = {
        english: normlizedKey,
        arabic: new Set<string>(),
        synonyms: new Set<string>(),
        debug: [],
      };
    }

    for (const arabicWord of quran[key].arabic) {
      updatedQuran[normlizedKey].arabic.add(arabicWord);
    }

    // updated_quran[normlizedKey].synonyms.add(quran[key].english);

    updatedQuran[normlizedKey].debug.push({ key, wordText: normlizedKey });
  }

  return updatedQuran;
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

async function addSynonyms(quran: Record<string, DictionaryEntry>) {
  const limit = pLimit(500);
  const keys = Object.keys(quran);

  await Promise.all(
    keys.map((key) =>
      limit(async () => {
        const result = await getTopSynonyms(key, 5);
        quran[key].synonyms = new Set(result);
      }),
    ),
  );
}

interface ExportedData {
  english: string[];
  arabic: string[];
}

async function extractArabicRoots(
  dataset: Record<string, DictionaryEntry>,
): Promise<ExportedData[]> {
  const limit = pLimit(500);
  const wordMap: Record<
    string,
    {
      root?: string;
    }
  > = JSON.parse(readFileSync('../../src/data/word-map.json', 'utf8'));

  const mapArabicToRoot = async (word: string): Promise<string> => {
    const normalize = (w: string) => w.replace(/[\s-]/g, '');
    const entry = wordMap[word];
    if (entry?.root) {
      return normalize(entry.root);
    }
    return '';
  };
  const entries = Object.values(dataset);

  const exportedData = await Promise.all(
    entries
      .filter((entry) => entry.english && entry.english.trim() !== '')
      .map(async (entry) => {
        const english = [...new Set([entry.english, ...entry.synonyms])];
        const arabicArray = await Promise.all(
          [...entry.arabic].map((word) => limit(() => mapArabicToRoot(word))),
        );
        const arabic = [...new Set(arabicArray)];
        return { english, arabic };
      }),
  );

  return exportedData;
}
async function main(): Promise<void> {
  const raw = readFileSync('colored-english-wbw-translation.json', 'utf8');
  const sourceData: Record<string, any> = JSON.parse(raw);
  const dictMap: Record<string, DictionaryEntry> = {};

  const quran: AyaMap = arrayToMap(JSON.parse(readFileSync('../../src/data/quran.json', 'utf8')));

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

  const cleanedDictMap = await normalizeDatasetWithNlp(dictMap);

  await addSynonyms(cleanedDictMap);

  const exportFormat: ExportedData[] = await extractArabicRoots(cleanedDictMap);

  const debugNotMeaningfulSentences: string[] = [];

  for (const sentence of nonMeaningfulSentences) {
    const keyword = extractKeyword(sentence);
    if (!keyword) {
      // push the sentences with no meaningful word
      debugNotMeaningfulSentences.push(sentence);
    }
  }

  writeFileSync('quran-english-arabic-roots.json', JSON.stringify(exportFormat, null, 2));
  writeFileSync('debug_nlp_mapped_words.json', JSON.stringify(mappedNlpWords, null, 2));
  writeFileSync(
    'debug_no_meaning_sentence.json',
    JSON.stringify(debugNotMeaningfulSentences, null, 2),
  );
}

main();
