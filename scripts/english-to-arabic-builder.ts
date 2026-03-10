import { readFileSync, writeFileSync, existsSync } from 'fs';
import puppeteer from 'puppeteer-core';
import { JSDOM } from 'jsdom';
import path from 'path';

const CACHE_FILE = path.resolve('cache_llm_words.json');
let cache_llm_words: Record<string, string> = {};
if (existsSync(CACHE_FILE)) {
  try {
    cache_llm_words = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to parse cache file, starting with empty cache', err);
    cache_llm_words = {};
  }
} else {
  writeFileSync(CACHE_FILE, JSON.stringify({}), 'utf-8');
}
function addWordToCache(key: string, normalized: string) {
  cache_llm_words[key] = normalized;
  // Write back to file
  writeFileSync(CACHE_FILE, JSON.stringify(cache_llm_words, null, 2), 'utf-8');
}

function extractLastAssistantText(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Select all elements with the target class
  const elements = document.querySelectorAll('.markdown');
  console.log(elements);
  if (!elements.length) {
    console.log("No element found with class 'markdown'");
    return '';
  }

  // Get the last element
  const lastElement = elements[elements.length - 1];

  // Return its plain text
  return lastElement.textContent?.trim() || '';
}

/**
 * Sends a message to ChatGPT and returns the full HTML of the last assistant message container
 */
async function queryChatGpt(message: string): Promise<string> {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
  });

  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('chat.openai.com'));

  if (!page) {
    page = await browser.newPage();
    await page.goto('https://chat.openai.com/');
  }

  const inputSelector = '[contenteditable="true"]';
  await page.waitForSelector(inputSelector);

  // Count messages before sending
  const beforeCount = await page.evaluate(() => document.querySelectorAll('div.gap-2').length);

  // Send message
  await page.click(inputSelector);
  await page.keyboard.type(message);
  await page.keyboard.press('Enter');
  console.log('Prompt sent... waiting for response...');

  // Wait for new message container
  await page.waitForFunction(
    (count) => document.querySelectorAll('div.gap-2').length > count,
    {},
    beforeCount,
  );

  // Short-polling loop
  let lastHTML = '';
  let stableCounter = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const html = await page.evaluate(() => {
      const last = document.documentElement.outerHTML;
      if (!last) return '';

      return last; // return the full element HTML including the container
    });

    if (html === lastHTML) {
      stableCounter++;
    } else {
      stableCounter = 0;
      lastHTML = html;
    }

    // Stop if HTML hasn't changed for 2 intervals
    if (stableCounter >= 2) break;

    await new Promise((res) => setTimeout(res, 100)); // poll every 100s
  }
  const word = extractLastAssistantText(lastHTML);
  await page.close();

  return word;
}

async function normalizeEnglish(englishText: string): Promise<string> {
  if (englishText in cache_llm_words) {
    return cache_llm_words[englishText];
  }

  const prompt: string = `Normalize this Holy Quran English sentence to a single canonical word representing its main meaning. Ignore articles like "the","a","an". Map similar meanings to the same word. Replace "God" with "Allah" but leave "Allah" unchanged. Examples:"The Most Merciful"→merciful,"The Most Gracious"→merciful,"Full of kindness and mercy"→merciful,"Strong and powerful"→powerful,"God is Most Merciful"→merciful,"Allah is Most Merciful"→merciful. Sentence:\`${englishText}\`. Return only the normalized word.`;
  const res = await queryChatGpt(prompt);
  console.log(`original word: ${englishText} <===> normalized word: ${res}`);
  addWordToCache(englishText, res);
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

async function normlizeDatasetWithLLM(quran: Record<string, DictionaryEntry>) {
  const updated_quran: Record<string, DictionaryEntry> = {};

  for (const key of Object.keys(quran)) {
    const normlizedKey = await normalizeEnglish(key);

    if (!(normlizedKey in updated_quran)) {
      updated_quran[normlizedKey] = {
        english: normlizedKey,
        arabic: new Set<string>(),
        synonyms: new Set<string>(),
        debug: [],
      };
    }

    for (const arabicWord of quran[key].arabic) {
      updated_quran[normlizedKey].arabic.add(arabicWord);
    }

    updated_quran[normlizedKey].synonyms.add(quran[key].english);

    updated_quran[normlizedKey].debug.push({ key, wordText: normlizedKey });
  }

  return updated_quran;
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

  normlizeDatasetWithLLM(dictMap).then((cleanedDictMap) => {
    const output = Object.values(cleanedDictMap).map((entry) => ({
      english: entry.english,
      arabic: Array.from(entry.arabic),
      synonyms: Array.from(entry.synonyms),
      // debug: entry.debug,
    }));

    writeFileSync('english-arabic-dictionary.json', JSON.stringify(output, null, 2));
  });
}

main();
