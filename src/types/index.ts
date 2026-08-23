import type { FuseResultMatch } from 'fuse.js';

export type QuranText = {
  sura_id: number;
  aya_id_display: string;
  uthmani: string;
  gid: number;
  aya_id: number;
  page_id: number;
  juz_id: number;
  standard: string;
  standard_full: string;
  sura_name: string;
  sura_name_en: string;
  sura_name_romanization: string;
};

export type VerseInput = {
  gid: number;
  uthmani: string;
  standard: string;
  aya_id?: number;
  sura_id?: number; // Allows the engine to read the Surah ID from the JSON data
  juz_id?: number; // Allows the engine to read the Juz ID
  sura_name?: string;
  sura_name_en?: string;
  sura_name_romanization?: string;
};

export type VerseWithFuseMatches<TVerse extends VerseInput = QuranText> = TVerse & {
  fuseMatches?: readonly FuseResultMatch[];
};

export type MorphologyAya = {
  gid: number;
  lemmas: string[];
  roots: string[];
};

export type WordMap = Map<
  string,
  {
    lemma?: string;
    root?: string;
  }
>;

export type SearchContext<TVerse extends VerseInput = QuranText> = {
  quranData: Map<number, TVerse>;
  morphologyMap: Map<number, MorphologyAya>;
  wordMap: WordMap;
  invertedIndex?: InvertedIndex;
  semanticMap?: Map<string, string[]>;
  subjectMap?: Map<string, string[]>;
  phoneticMap?: Map<string, string[]>;
};

export type MatchType =
  | 'exact'
  | 'lemma'
  | 'root'
  | 'fuzzy'
  | 'range'
  | 'none'
  | 'semantic'
  | 'subject'
  | 'regex';

export type ScoredVerse<TVerse extends VerseInput = QuranText> = TVerse & {
  matchScore: number;
  matchType: MatchType;
  matchedTokens: string[];
  tokenTypes?: Record<string, MatchType>;
};

export type ScoredQuranText = ScoredVerse<QuranText>;

export type AdvancedSearchOptions = {
  lemma: boolean;
  root: boolean;
  fuzzy?: boolean;
  isRegex?: boolean;
  suraId?: number;
  juzId?: number;
  suraName?: string;
  sura_name_en?: string;
  sura_name_romanization?: string;
  semantic?: boolean;
  subject?: boolean;
};

export type SearchOptions = AdvancedSearchOptions;

export type SearchCounts = {
  simple: number;
  lemma: number;
  root: number;
  fuzzy: number;
  range: number;
  semantic: number;
  subject: number;
  regex: number;
  total: number;
};

export type PaginationOptions = {
  page?: number;
  limit?: number;
};

export type SearchResponse<TVerse extends VerseInput = QuranText> = {
  results: ScoredVerse<TVerse>[];
  counts: SearchCounts;
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

/** Ranking strategy for search()'s multi-term (string[]) results. */
export type RankBy = 'score' | 'coverage' | 'frequency';

export type MultiTermOptions = PaginationOptions & {
  rankBy?: RankBy;
};

/** A verse matched by one or more independent term searches, with per-verse aggregation metadata. */
export type MergedSearchResult<TVerse extends VerseInput = QuranText> = ScoredVerse<TVerse> & {
  matchedTerms: string[];
  distinctTermCount: number;
  totalFrequency: number;
};

export type MultiTermResponse<TVerse extends VerseInput = QuranText> = {
  results: MergedSearchResult<TVerse>[];
  counts: SearchCounts;
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export type ErrorShape = {
  message: string;
  code: string;
  type: string;
};

export interface Sura {
  id: number;
  sura_name: string;
  sura_name_en: string;
  sura_name_romanization: string;
  total_verses: number;
  juz_ids: number[];
  page_start: number;
  page_end?: number;
}
/**
 * Represents a parsed range query targeting specific sura/aya coordinates.
 *
 * @example
 * // Single verse: "2:255"
 * { sura: 2, startAya: 255 }
 *
 * // Verse range: "1:1-7"
 * { sura: 1, startAya: 1, endAya: 7 }
 *
 * // Entire sura: "2:"
 * { sura: 2 }
 */
export type ParsedRange = {
  /** Sura number (1–114). */
  sura: number;
  /** Starting aya number. Undefined when the entire sura is requested. */
  startAya?: number;
  /** Ending aya number (inclusive). Only present for range queries like `1:1-7`. */
  endAya?: number;
};

/** Normalized lemma string → Set of verse GIDs containing that lemma */
export type LemmaIndex = Map<string, Set<number>>;

/** Normalized root string → Set of verse GIDs containing that root */
export type RootIndex = Map<string, Set<number>>;

/** Normalized word string → Set of verse GIDs containing that word */
export type WordIndex = Map<string, Set<number>>;

/** Normalized subject/theme string → Set of verse GIDs containing related lemmas */
export type SubjectIndex = Map<string, Set<number>>;

/** Container for all inverted indices */
export type InvertedIndex = {
  lemmaIndex: LemmaIndex;
  rootIndex: RootIndex;
  wordIndex: WordIndex;
  semanticIndex?: Map<string, Set<number>>;
  subjectIndex?: SubjectIndex;
};

/** Boolean query object for booleanSearch() **/
export interface BooleanQuery {
  must: string[]; // +term — all must match
  exclude: string[]; // -term — none can match
  either: string[]; // bare terms or | groups — at least one must match
}
