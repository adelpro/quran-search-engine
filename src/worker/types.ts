import type {
  AdvancedSearchOptions,
  PaginationOptions,
  SearchResponse,
  MultiTermOptions,
  MultiTermResponse,
  VerseInput,
} from '../types';

// ── Message types ──────────────────────────────────────────────

export type WorkerMessageType = 'INIT_DATA' | 'RUN_SEARCH' | 'RUN_SEARCH_MANY' | 'DISPOSE';
export type WorkerResponseType =
  | 'INIT_DATA_RESULT'
  | 'SEARCH_RESULT'
  | 'SEARCH_MANY_RESULT'
  | 'ERROR';

// ── Request payloads (main → worker) ───────────────────────────

export type InitDataRequest = {
  type: 'INIT_DATA';
  requestId: string;
};

export type RunSearchRequest = {
  type: 'RUN_SEARCH';
  requestId: string;
  query: string;
  options: AdvancedSearchOptions;
  pagination: PaginationOptions;
};

export type RunSearchManyRequest = {
  type: 'RUN_SEARCH_MANY';
  requestId: string;
  terms: string[];
  options: AdvancedSearchOptions;
  searchManyOptions: MultiTermOptions;
};

export type DisposeRequest = {
  type: 'DISPOSE';
};

export type WorkerRequest =
  | InitDataRequest
  | RunSearchRequest
  | RunSearchManyRequest
  | DisposeRequest;

// ── Response payloads (worker → main) ──────────────────────────

export type InitDataResponse = {
  type: 'INIT_DATA_RESULT';
  requestId: string;
  success: boolean;
  error?: string;
};

export type SearchResultResponse<TVerse extends VerseInput = VerseInput> = {
  type: 'SEARCH_RESULT';
  requestId: string;
  data: SearchResponse<TVerse>;
  timingMs: number;
};

export type SearchManyResultResponse<TVerse extends VerseInput = VerseInput> = {
  type: 'SEARCH_MANY_RESULT';
  requestId: string;
  data: MultiTermResponse<TVerse>;
  timingMs: number;
};

export type ErrorResponse = {
  type: 'ERROR';
  requestId: string;
  error: string;
};

export type WorkerResponse<TVerse extends VerseInput = VerseInput> =
  | InitDataResponse
  | SearchResultResponse<TVerse>
  | SearchManyResultResponse<TVerse>
  | ErrorResponse;

// ── Client interface ───────────────────────────────────────────

export interface SearchWorkerClient {
  /** Load Quran data, morphology, and word map inside the Worker. */
  initData(): Promise<void>;

  /** Run a search inside the Worker and return the response. */
  runSearch(
    query: string,
    options: AdvancedSearchOptions,
    pagination: PaginationOptions,
  ): Promise<SearchResponse>;

  /** Run an independent multi-term search inside the Worker and return the merged response. */
  runSearchMany(
    terms: string[],
    options: AdvancedSearchOptions,
    searchManyOptions: MultiTermOptions,
  ): Promise<MultiTermResponse>;

  /** Terminate the underlying Worker. */
  terminate(): void;
}
