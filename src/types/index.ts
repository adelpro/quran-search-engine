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

export type ScoredQuranText = QuranText & {
  matchScore: number;
  matchType: MatchType;
  matchedTokens: string[];
};

export type AdvancedSearchOptions = {
  lemma: boolean;
  root: boolean;
};

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

export type SearchResponse = {
  results: ScoredQuranText[];
  counts: SearchCounts;
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};
