import { search } from '../core/search';
import { loadMorphology, loadQuranData, loadWordMap } from '../utils/loader';
import type {
  AdvancedSearchOptions,
  MorphologyAya,
  PaginationOptions,
  QuranText,
  SearchResponse,
  WordMap,
} from '../types';

export type WorkerRequest = {
  id: number;
  type: 'init' | 'search';
  payload?: {
    query: string;
    options?: AdvancedSearchOptions;
    pagination?: PaginationOptions;
  };
};

export type WorkerResponse = {
  id: number;
  type: 'init-done' | 'search-result' | 'error';
  payload?: SearchResponse<QuranText>;
  error?: string;
};

let quranData: QuranText[] = [];
let morphologyMap: Map<number, MorphologyAya> = new Map();
let wordMap: WordMap = {};
let initialized = false;

const handleInit = async (): Promise<void> => {
  [quranData, morphologyMap, wordMap] = await Promise.all([
    loadQuranData(),
    loadMorphology(),
    loadWordMap(),
  ]);
  initialized = true;
};

const handleSearch = (
  query: string,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
): SearchResponse<QuranText> => {
  if (!initialized) {
    throw new Error('Worker not initialized. Call init first.');
  }
  return search(query, quranData, morphologyMap, wordMap, options, pagination);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'init') {
      await handleInit();
      self.postMessage({ id, type: 'init-done' } satisfies WorkerResponse);
    } else if (type === 'search') {
      if (!payload?.query) {
        self.postMessage({
          id,
          type: 'error',
          error: 'Missing query in search request',
        } satisfies WorkerResponse);
        return;
      }
      const result = handleSearch(payload.query, payload.options, payload.pagination);
      self.postMessage({ id, type: 'search-result', payload: result } satisfies WorkerResponse);
    } else {
      self.postMessage({
        id,
        type: 'error',
        error: `Unknown message type: ${type}`,
      } satisfies WorkerResponse);
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
