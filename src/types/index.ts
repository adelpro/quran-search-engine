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
};

export type MorphologyAya = {
  gid: number;
  lemmas: string[];
  roots: string[];
};

export type WordMap = {
  [key: string]: {
    lemma?: string;
    root?: string;
  };
};

export type MatchType = 'exact' | 'lemma' | 'root' | 'fuzzy' | 'none';

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
};

export type SearchOptions = AdvancedSearchOptions;

export type SearchCounts = {
  simple: number;
  lemma: number;
  root: number;
  fuzzy: number;
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