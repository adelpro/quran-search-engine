import Fuse from 'fuse.js';
import { normalizeArabic, isArabic } from '../../utils/normalization';
import { expandAffixVariants } from '../../utils/arabic-affixes';
import type {
  VerseInput,
  ScoredVerse,
  AdvancedSearchOptions,
  InvertedIndex,
  MorphologyAya,
  WordMap,
} from '../../types';

// subjectMap is loaded dynamically (loadSubjectData()) rather than held in one module-level
// constant, so — unlike getPhoneticFuse's single cached instance — a single global Fuse
// index would silently serve stale results once a second, different subjectMap appeared
// (e.g. each test file builds its own). A WeakMap keys the cache on the subjectMap instance
// itself: each distinct map gets its own fuzzy index, built once, with no manual cleanup
// once that subjectMap is no longer referenced anywhere.
const subjectFuseCache = new WeakMap<Map<string, string[]>, Fuse<string>>();

const getSubjectFuse = (subjectMap: Map<string, string[]>): Fuse<string> => {
  let fuse = subjectFuseCache.get(subjectMap);
  if (!fuse) {
    // English keys only — Arabic theme keys (registered in loader.ts for #117) would never
    // meaningfully fuzzy-match a Latin token, so excluding them keeps the index smaller and
    // the intent explicit.
    const englishKeys = Array.from(subjectMap.keys()).filter((key) => /^[a-z\s]+$/.test(key));
    fuse = new Fuse(englishKeys, {
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 3,
      includeScore: true,
    });
    subjectFuseCache.set(subjectMap, fuse);
  }
  return fuse;
};

/** Resolve a raw query string to the set of Arabic words it stands for. */
const resolveQuery = (rawQuery: string, subjectMap: Map<string, string[]>): Set<string> => {
  const matchedArabicWords = new Set<string>();

  // Try the full query as a phrase key first — resolves multi-word aliases
  // like "eternal life", "judgment day", "blazing fire".
  const fullPhrase = rawQuery
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
  if (fullPhrase && subjectMap.has(fullPhrase)) {
    subjectMap.get(fullPhrase)?.forEach((w) => matchedArabicWords.add(w));
  }

  for (const token of rawQuery.split(/\s+/)) {
    if (isArabic(token)) {
      const normalized = normalizeArabic(token);
      if (!normalized) continue;
      const subjectWords = subjectMap.get(normalized);
      if (subjectWords) {
        subjectWords.forEach((w) => matchedArabicWords.add(w));
      } else {
        matchedArabicWords.add(normalized);
      }
      continue;
    }

    const cleanToken = token
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim();
    if (!cleanToken) continue;
    const subjectWords = subjectMap.get(cleanToken);
    if (subjectWords) {
      subjectWords.forEach((w) => matchedArabicWords.add(w));
    } else {
      // Exact match failed — fall back to a strict fuzzy match against the English keys,
      // so a typo like "rrain" or "climte" still resolves instead of being dropped silently.
      const [fuzzyMatch] = getSubjectFuse(subjectMap).search(cleanToken);
      if (fuzzyMatch) {
        subjectMap.get(fuzzyMatch.item)?.forEach((w) => matchedArabicWords.add(w));
      }
    }
  }

  return matchedArabicWords;
};

/**
 * The three ways a subject word is allowed to match a verse.
 *
 * Both the indexed and the scan path evaluate exactly these rules against exactly the same
 * source data — `rootIndex`/`lemmaIndex` are built from `morphologyMap`, and `wordIndex` is
 * built from the same normalized verse tokens the scan path splits — so the two paths agree
 * by construction rather than by coincidence.
 *
 * 1. Shared root: `مطر` carries root `م-ط-ر`, which also covers `وأمطرنا` and `ممطرنا`.
 * 2. Shared lemma: the word is the verse's own dictionary form.
 * 3. Clitic variant: the word appears as a whole token once particles are attached (`الرياح`).
 *
 * Substring containment is deliberately *not* one of them: it would match `ماء` inside
 * `سماء` and `اب` inside `كتاب`, which pulled roughly a fifth of the Quran into unrelated
 * subjects.
 */
export type SubjectWordResolver = {
  /** Root registered for the word, if the morphology knows one. */
  root?: string;
  /** Surface tokens the word can legitimately appear as. */
  variants: Set<string>;
};

const buildResolvers = (
  words: Set<string>,
  wordMap?: WordMap,
): Map<string, SubjectWordResolver> => {
  const resolvers = new Map<string, SubjectWordResolver>();
  for (const word of words) {
    resolvers.set(word, {
      root: wordMap?.get(word)?.root,
      variants: new Set(expandAffixVariants(word)),
    });
  }
  return resolvers;
};

const addHit = (hits: Map<number, string[]>, gid: number, word: string): void => {
  const matched = hits.get(gid);
  if (!matched) hits.set(gid, [word]);
  else if (!matched.includes(word)) matched.push(word);
};

const collectIndexedHits = (
  resolvers: Map<string, SubjectWordResolver>,
  invertedIndex: InvertedIndex,
): Map<number, string[]> => {
  const hits = new Map<number, string[]>();
  for (const [word, { root, variants }] of resolvers) {
    if (root) invertedIndex.rootIndex.get(root)?.forEach((gid) => addHit(hits, gid, word));
    invertedIndex.lemmaIndex.get(word)?.forEach((gid) => addHit(hits, gid, word));
    for (const variant of variants) {
      invertedIndex.wordIndex.get(variant)?.forEach((gid) => addHit(hits, gid, word));
    }
  }
  return hits;
};

/** Whether `word` (via its resolver) matches the given verse's root, lemma, or surface tokens. */
const resolverMatchesVerse = (
  word: string,
  { root, variants }: SubjectWordResolver,
  tokens: string[],
  morph?: MorphologyAya,
): boolean => {
  if (root !== undefined && morph?.roots?.includes(root)) return true;
  if (morph?.lemmas?.includes(word)) return true;
  return tokens.some((token) => variants.has(token));
};

const collectScanHits = (
  resolvers: Map<string, SubjectWordResolver>,
  quranData: Map<number, VerseInput>,
  morphologyMap?: Map<number, MorphologyAya>,
): Map<number, string[]> => {
  const hits = new Map<number, string[]>();
  for (const verse of quranData.values()) {
    const morph = morphologyMap?.get(verse.gid);
    const tokens = normalizeArabic(verse.standard).split(/\s+/);
    for (const [word, resolver] of resolvers) {
      if (resolverMatchesVerse(word, resolver, tokens, morph)) addHit(hits, verse.gid, word);
    }
  }
  return hits;
};

/**
 * Map every matching verse GID to the subject words that matched it.
 *
 * Uses the inverted index when one is supplied and falls back to a full scan otherwise;
 * both paths apply the rules documented on {@link SubjectWordResolver}.
 */
export const collectSubjectHits = (
  words: Set<string>,
  quranData: Map<number, VerseInput>,
  wordMap?: WordMap,
  morphologyMap?: Map<number, MorphologyAya>,
  invertedIndex?: InvertedIndex,
): Map<number, string[]> => {
  const resolvers = buildResolvers(words, wordMap);
  if (invertedIndex) return collectIndexedHits(resolvers, invertedIndex);
  return collectScanHits(resolvers, quranData, morphologyMap);
};

/** Apply the scope filters and turn a verse plus its matched words into a scored result. */
const scoreVerse = <TVerse extends VerseInput>(
  verse: TVerse,
  options: AdvancedSearchOptions,
  matchedKeywords: string[],
): ScoredVerse<TVerse> | null => {
  if (options.suraId && verse.sura_id !== options.suraId) return null;
  if (options.juzId && verse.juz_id !== options.juzId) return null;
  if (options.suraName && verse.sura_name !== options.suraName) return null;

  return {
    ...verse,
    matchType: 'subject',
    matchScore: matchedKeywords.length * 4,
    matchedTokens: matchedKeywords,
  };
};

export const performSubjectSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: Map<number, TVerse>,
  options: AdvancedSearchOptions,
  subjectMap?: Map<string, string[]>,
  originalQuery?: string,
  invertedIndex?: InvertedIndex,
  wordMap?: WordMap,
  morphologyMap?: Map<number, MorphologyAya>,
): ScoredVerse<TVerse>[] => {
  if (!options.subject || !subjectMap) return [];

  const matchedArabicWords = resolveQuery((originalQuery ?? query).trim(), subjectMap);

  if (matchedArabicWords.size === 0) return [];

  // Resolution is keyed on the words themselves, never on `invertedIndex.subjectIndex`. That
  // index is a per-subject GID cache for consumers browsing a whole theme; consulting it here
  // would reintroduce two sources of truth for the same question, which is precisely how the
  // indexed and scan paths drifted apart before.
  const hits = collectSubjectHits(
    matchedArabicWords,
    quranData,
    wordMap,
    morphologyMap,
    invertedIndex,
  );

  const results: ScoredVerse<TVerse>[] = [];
  for (const [gid, matchedKeywords] of hits) {
    const verse = quranData.get(gid);
    if (!verse) continue;
    const scored = scoreVerse(verse, options, matchedKeywords);
    if (scored) results.push(scored);
  }
  return results;
};
