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
import type { WorkerRequest, WorkerResponse } from './search-worker';

export type { WorkerRequest, WorkerResponse } from './search-worker';

export type SearchWorkerClient = {
  init: () => Promise<void>;
  search: (
    query: string,
    options?: AdvancedSearchOptions,
    pagination?: PaginationOptions,
  ) => Promise<SearchResponse<QuranText>>;
  terminate: () => void;
};

const createWorkerClient = (worker: Worker): SearchWorkerClient => {
  let messageId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { id, type, payload, error } = event.data;
    const handler = pending.get(id);
    if (!handler) return;
    pending.delete(id);

    if (type === 'error') {
      handler.reject(new Error(error || 'Unknown worker error'));
    } else {
      handler.resolve(payload);
    }
  };

  worker.onerror = (event: ErrorEvent) => {
    for (const [, handler] of pending) {
      handler.reject(new Error(event.message || 'Worker error'));
    }
    pending.clear();
  };

  const sendMessage = <T>(message: Omit<WorkerRequest, 'id'>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      try {
        worker.postMessage({ ...message, id });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  };

  return {
    init: () => sendMessage<void>({ type: 'init' }),
    search: (query, options, pagination) =>
      sendMessage<SearchResponse<QuranText>>({
        type: 'search',
        payload: { query, options, pagination },
      }),
    terminate: () => {
      for (const [, handler] of pending) {
        handler.reject(new Error('Worker terminated'));
      }
      pending.clear();
      worker.terminate();
    },
  };
};

const createFallbackClient = (): SearchWorkerClient => {
  let quranData: QuranText[] = [];
  let morphologyMap: Map<number, MorphologyAya> = new Map();
  let wordMap: WordMap = {};
  let initialized = false;

  return {
    init: async () => {
      [quranData, morphologyMap, wordMap] = await Promise.all([
        loadQuranData(),
        loadMorphology(),
        loadWordMap(),
      ]);
      initialized = true;
    },
    search: async (
      query,
      options = { lemma: true, root: true },
      pagination = { page: 1, limit: 20 },
    ) => {
      if (!initialized) {
        throw new Error('Client not initialized. Call init first.');
      }
      if (!query) {
        throw new Error('Missing query in search request');
      }
      return search(query, quranData, morphologyMap, wordMap, options, pagination);
    },
    terminate: () => {},
  };
};

export const createSearchWorker = (workerFactory?: () => Worker): SearchWorkerClient => {
  if (workerFactory) {
    try {
      const worker = workerFactory();
      return createWorkerClient(worker);
    } catch {
      return createFallbackClient();
    }
  }

  if (typeof Worker !== 'undefined') {
    try {
      const workerUrl = new URL('./search-worker.js', import.meta.url);
      const worker = new Worker(workerUrl, { type: 'module' });
      return createWorkerClient(worker);
    } catch {
      return createFallbackClient();
    }
  }

  return createFallbackClient();
};
