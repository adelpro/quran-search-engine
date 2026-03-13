import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

type MismatchedWord = {
  surah: number;
  verse: number;
  reason?: string;
  ayah_offset_used?: number;
  counts?: {
    arabic: number;
    normalized: number;
    phonetic: number;
    simple: number;
  };
  arabic?: string[];
  normalized?: string[];
  phonetic_original?: string[];
  phonetic_clean?: string[];
  simple?: string[];
};

// Cleans a phonetic token (trims, removes symbols, lowercases)
function cleanPhoneticToken(token: string): string {
  return token.replace(/^[^\w\u0600-\u06FF]+|[^\w\u0600-\u06FF]+$/g, '').toLowerCase();
}

// Splits a line into phonetic tokens
function tokenizePhoneticLine(line: string): string[] {
  if (!line || typeof line !== 'string') return [];
  return line
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Normalizes Arabic text for buckwalter (replaces letters, removes diacritics)
function normalizeArabicForBuckwalter(text: unknown): string {
  if (typeof text !== 'string') return '';
  let t = text;
  const replacements: Record<string, string> = {
    ٱ: 'ا',
    'ٰ': 'ا',
    أ: 'ا',
    إ: 'ا',
    آ: 'ا',
    ى: 'ي',
    ؤ: 'و',
    ئ: 'ي',
    ة: 'ه',
  };
  for (const [src, tgt] of Object.entries(replacements)) t = t.split(src).join(tgt);
  t = t.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g, '');
  t = t.replace(/[^\u0621-\u064A\s]/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

// Removes Quranic stops/diacritics from Arabic text
function removeQuranicStops(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u06D6-\u06ED]/g, '')
    .replace(/[ۖۗۘۙۚۛۜ۝۞]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Converts Arabic letters to simple Latin equivalents
function arabicToSimpleLatin(text: unknown): string {
  if (typeof text !== 'string') return '';
  const map: Record<string, string> = {
    ا: 'a',
    ب: 'b',
    ت: 't',
    ث: 'th',
    ج: 'j',
    ح: 'h',
    خ: 'kh',
    د: 'd',
    ذ: 'dh',
    ر: 'r',
    ز: 'z',
    س: 's',
    ش: 'sh',
    ص: 's',
    ض: 'd',
    ط: 't',
    ظ: 'z',
    ع: 'a',
    غ: 'gh',
    ف: 'f',
    ق: 'q',
    ك: 'k',
    ل: 'l',
    م: 'm',
    ن: 'n',
    ه: 'h',
    و: 'w',
    ي: 'y',
    ء: 'a',
  };
  return [...text].map((c) => map[c] ?? c).join('');
}

// Cleans a token for matching (similar to cleanPhoneticToken)
function cleanTokenForMatch(s: string) {
  return s.replace(/^[^\w\u0600-\u06FF]+|[^\w\u0600-\u06FF]+$/g, '').toLowerCase();
}

// Tries to merge phonetic tokens to reduce their count to match Arabic words
// Example: ['ayn','ama'] → ['aynama'] to align with 1 Arabic word
function attemptMergeToTarget(
  phoneticWords: string[],
  targetLen: number,
  seeds: string[],
): { merged: string[]; info: string } | null {
  let current = [...phoneticWords];
  for (let attempt = 0; attempt < 5; attempt++) {
    if (current.length === targetLen)
      return { merged: current, info: `merged after ${attempt} attempts` };
    if (current.length <= targetLen) break;
    let changed = false;
    for (let i = 0; i < current.length - 1 && current.length > targetLen; i++) {
      const tokenClean = cleanTokenForMatch(current[i]);
      for (const seed of seeds) {
        if (tokenClean === seed.toLowerCase()) {
          current = [...current.slice(0, i), current[i] + current[i + 1], ...current.slice(i + 2)];
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  return current.length === targetLen
    ? { merged: current, info: 'merged via repeated seeds' }
    : null;
}

// Tries to split phonetic tokens so their count matches the Arabic words
// Example: ['ya','ayha'] → ['ياايها'] (1 word) can be split to match
function attemptSplitToTarget(
  phoneticWords: string[],
  targetLen: number,
  splitMap: Record<string, string[]>,
): { split: string[]; info: string } | null {
  let current = [...phoneticWords];
  for (let attempt = 0; attempt < 5; attempt++) {
    if (current.length === targetLen)
      return { split: current, info: `split after ${attempt} attempts` };
    if (current.length >= targetLen) break;
    let changed = false;
    for (let i = 0; i < current.length && current.length < targetLen; i++) {
      const tokenClean = cleanTokenForMatch(current[i]);
      const mapping = splitMap[tokenClean];
      if (mapping) {
        current = [...current.slice(0, i), ...mapping, ...current.slice(i + 1)];
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return current.length === targetLen ? { split: current, info: 'split via repeated seeds' } : null;
}

//main pipeline
function main() {
  const rawInputPath = path.join(__dirname, 'raw_data', 'quran_transliteration.txt');
  const cleanedOutputPath = path.join(__dirname, 'cleaned_data', 'cleaned.txt');

  const rawText = fs.readFileSync(rawInputPath, 'utf-8');
  const withoutHeader = rawText.split('The Calgary Islamic Homepage').join('');
  const cleanedText = withoutHeader.replace(/\r\n/g, '\n').replace(/[^A-Za-z0-9. \n]+/g, '');

  //make clean dir if not exists
  fs.mkdirSync(path.dirname(cleanedOutputPath), { recursive: true });
  fs.writeFileSync(cleanedOutputPath, cleanedText, 'utf-8');

  const surahOutputDir = path.join(__dirname, 'cleaned_data', 'surahs');
  const surahSections = cleanedText.split('Surah');
  surahSections.slice(1).forEach((section) => {
    const match = section.match(/\d+/);
    if (!match) return;
    fs.mkdirSync(surahOutputDir, { recursive: true });
    fs.writeFileSync(path.join(surahOutputDir, match[0]), section.trim(), 'utf-8');
  });

  //Read quran csv quran from raw_data dir
  const quranJsonPath = '../../src/data/quran.json';
  const quranContent = fs.readFileSync(quranJsonPath, 'utf-8');

  const quranRows = JSON.parse(quranContent);

  const ayahData = quranRows.map((row: any) => ({
    id: String(row.gid ?? ''),
    number: String(row.aya_id ?? ''),
    text: row.uthmani ?? '',
    number_in_surah: String(row.aya_id ?? ''),
    page: String(row.page_id ?? ''),
    sura_id: String(row.sura_id ?? ''),
    hizb_id: '', // not present in JSON
    juz_id: String(row.juz_id ?? ''),
    sajda: '', // not present in JSON
    created_at: '',
    updated_at: '',
  }));

  const ayahLookup = new Map<string, (typeof ayahData)[0]>();
  ayahData.forEach((a) => ayahLookup.set(`${Number(a.sura_id)}-${Number(a.number_in_surah)}`, a));

  //Remove all basmala from the entier quran
  const basmalaRegex = /بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ/g;
  ayahData.forEach((a) => {
    a.text = typeof a.text === 'string' ? a.text.split(basmalaRegex).join('').trim() : '';
    a.normalized_text = normalizeArabicForBuckwalter(a.text);
  });

  //keywords to merge to match number of words of quran words with phonetics quran words
  const mergeSeeds = [
    'ya',
    'awa',
    'waal',
    'baAAda',
    'ha',
    'wa',
    'likay',
    'waya',
    'ayna',
    'ma',
    'wanaa',
  ];

  //keywords to split to match number of words of quran words with phonetics quran word
  const splitSeedsMap: Record<string, string[]> = {
    aynama: ['ayn', 'ama'],
    feema: ['fee', 'ma'],
    mimma: ['min', 'ma'],
    amman: ['am', 'man'],
    walianaaamikum: ['wa', 'lianaaamikum'],
    awaman: ['awa', 'man'],
  };

  // Seed basmala as it's removed before from everywhere
  const allRecords: Array<[string, string, string, string]> = [
    // Manually add the basmala because it was removed during the cleaning step.
    ['بِسْمِ', 'بسم', 'Bismi', 'bsm'],
    ['ٱللَّهِ', 'الله', 'Allahi', 'allh'],
    ['ٱلرَّحْمَٰنِ', 'الرحمان', 'alrrahmani', 'alrhman'],
    ['ٱلرَّحِيمِ', 'الرحيم', 'alrraheemi', 'alrhym'],

    // Manually add 27:30 because it contains the basmala, which was removed earlier and causes misalignment.
    ['إِنَّهُ', 'انه', 'Innahu', 'innahu'],
    ['مِن', 'من', 'min', 'min'],
    ['سُلَیمَٰنَ', 'سلمان', 'sulaymana', 'sulaymana'],
    ['وَإِنَّهُ', 'وانه', 'wainnahu', 'wainnahu'],
  ];
  const not_matched_words: MismatchedWord[] = [];

  for (let surahId = 1; surahId <= 114; surahId++) {
    const surahPath = path.join(surahOutputDir, surahId.toString());
    if (!fs.existsSync(surahPath)) continue;
    const transliterationVerses = fs.readFileSync(surahPath, 'utf-8').split('.');

    for (let verseIndex = 2; verseIndex < transliterationVerses.length; verseIndex++) {
      const cleanedLine =
        transliterationVerses[verseIndex]?.replace(/\n/g, ' ').replace(/\d+$/, '').trim() ?? '';
      const phoneticWords = tokenizePhoneticLine(cleanedLine);
      const phoneticOriginal = [...phoneticWords];
      const phoneticClean = phoneticWords.map(cleanPhoneticToken);

      let verseRec: (typeof ayahData)[0] | undefined;
      let usedOffset = 0;
      for (const off of [0, -1, 1, -2, 2]) {
        const candidate = ayahLookup.get(`${surahId}-${verseIndex + off}`);
        if (candidate) {
          verseRec = candidate;
          usedOffset = off;
          break;
        }
      }
      if (!verseRec) {
        verseRec = ayahData.find(
          (a) => Number(a.sura_id) === surahId && Number(a.number_in_surah) === verseIndex,
        );
      }
      if (!verseRec) {
        not_matched_words.push({ surah: surahId, verse: verseIndex, reason: 'ayah_not_found' });
        continue;
      }

      const arabicWords = removeQuranicStops(verseRec.text).split(/\s+/).filter(Boolean);
      const normalizedWords = verseRec.normalized_text.split(/\s+/).filter(Boolean);
      const simpleLatinWords = normalizedWords.map(arabicToSimpleLatin);

      if (
        arabicWords.length === normalizedWords.length &&
        normalizedWords.length === phoneticWords.length &&
        phoneticWords.length === simpleLatinWords.length
      ) {
        for (let i = 0; i < arabicWords.length; i++) {
          allRecords.push([
            arabicWords[i],
            normalizedWords[i],
            phoneticOriginal[i] ?? '',
            simpleLatinWords[i],
          ]);
        }
        continue;
      }

      const targetLen = normalizedWords.length;
      let resolved = false;
      if (phoneticWords.length > targetLen && phoneticWords.length - targetLen <= 3) {
        const mergeAttempt = attemptMergeToTarget(phoneticWords, targetLen, mergeSeeds);
        if (mergeAttempt) {
          mergeAttempt.merged.forEach((w, i) =>
            allRecords.push([arabicWords[i], normalizedWords[i], w ?? '', simpleLatinWords[i]]),
          );
          console.log(
            `Merged seeds for Surah ${surahId} Verse ${verseIndex} (offset ${usedOffset}) → ${mergeAttempt.info}`,
          );

          resolved = true;
        }
      }
      if (resolved) continue;
      if (phoneticWords.length < targetLen && targetLen - phoneticWords.length <= 3) {
        const splitAttempt = attemptSplitToTarget(phoneticWords, targetLen, splitSeedsMap);
        if (splitAttempt) {
          splitAttempt.split.forEach((w, i) =>
            allRecords.push([arabicWords[i], normalizedWords[i], w ?? '', simpleLatinWords[i]]),
          );
          console.log(
            `Split seeds for Surah ${surahId} Verse ${verseIndex} (offset ${usedOffset}) → ${splitAttempt.info}`,
          );
          resolved = true;
        }
      }
      if (resolved) continue;

      not_matched_words.push({
        surah: surahId,
        verse: verseIndex,
        ayah_offset_used: usedOffset,
        counts: {
          arabic: arabicWords.length,
          normalized: normalizedWords.length,
          phonetic: phoneticWords.length,
          simple: simpleLatinWords.length,
        },
        arabic: arabicWords,
        normalized: normalizedWords,
        phonetic_original: phoneticOriginal,
        phonetic_clean: phoneticClean,
        simple: simpleLatinWords,
      });
    }
  }

  // Stores mismatched or problematic verses for debugging
  // The file debug_mismatch_verse.json will contain detailed info
  // about verses where alignment or other errors occurred
  if (not_matched_words.length != 0) {
    fs.writeFileSync(
      path.join(__dirname, 'debug_mismatch_verse.json'),
      JSON.stringify(not_matched_words, null, 2),
      'utf-8',
    );
  } else {
    console.log('There is no misatched words.');
  }

  //Build inverted Index
  const invertedIndex: Record<string, string[]> = {};
  allRecords.forEach(([, _normalized, full, short]) => {
    const arabic = _normalized;
    const keyFull = full.toLowerCase(),
      keyShort = short.toLowerCase();
    if (!invertedIndex[keyFull]) invertedIndex[keyFull] = [];
    if (!invertedIndex[keyFull].includes(arabic)) invertedIndex[keyFull].push(arabic);
    if (!invertedIndex[keyShort]) invertedIndex[keyShort] = [];
    if (!invertedIndex[keyShort].includes(arabic)) invertedIndex[keyShort].push(arabic);
  });
  Object.keys(invertedIndex).forEach((k) => invertedIndex[k].sort());
  const sortedIndex: Record<string, string[]> = {};
  Object.keys(invertedIndex)
    .sort()
    .forEach((k) => (sortedIndex[k] = invertedIndex[k]));
  const outputPath = path.join(__dirname, 'phonetic_inverted_index.json');
  fs.writeFileSync(outputPath, JSON.stringify(sortedIndex, null, 2), 'utf-8');
  console.log('Fully sorted inverted index saved to', outputPath);
}

main();
