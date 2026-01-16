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

export interface WordMap {
  [key: string]: {
    lemma?: string;
    root?: string;
  };
}

export type MatchType = 'exact' | 'lemma' | 'root' | 'fuzzy' | 'none';

export interface ScoredQuranText extends QuranText {
  matchScore: number;
  matchType: MatchType;
}

export interface AdvancedSearchOptions {
  lemma: boolean;
  root: boolean;
}
