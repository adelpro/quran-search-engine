import type {
  AdvancedSearchOptions,
  PaginationOptions,
  SearchResponse,
  VerseInput,
} from '../types';

// ── Message types ──────────────────────────────────────────────

export type WorkerMessageType = 'INIT_DATA' | 'RUN_SEARCH' | 'DISPOSE';
export type WorkerResponseType = 'INIT_DATA_RESULT' | 'SEARCH_RESULT' | 'ERROR';

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

export type DisposeRequest = {
  type: 'DISPOSE';
};

export type WorkerRequest = InitDataRequest | RunSearchRequest | DisposeRequest;

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

export type ErrorResponse = {
  type: 'ERROR';
  requestId: string;
  error: string;
};

export type WorkerResponse<TVerse extends VerseInput = VerseInput> =
  | InitDataResponse
  | SearchResultResponse<TVerse>
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

  /** Terminate the underlying Worker. */
  terminate(): void;
}
