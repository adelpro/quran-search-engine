/// <reference lib="webworker" />

import { search } from '../core/search';
import { LRUCache } from '../utils/lru-cache';
import {
  WorkerNotSupportedError,
  WorkerInitializationError,
  WorkerTerminatedError,
  WorkerNotInitializedError,
  WorkerFactoryError,
} from '../errors';
import type {
  AdvancedSearchOptions,
  PaginationOptions,
  SearchResponse,
  QuranText,
  SearchContext,
} from '../types';
import type { WorkerRequest, WorkerResponse, SearchWorkerClient } from './types';

// ── Feature detection ──────────────────────────────────────────

export function supportsWorkers(): boolean {
  return typeof globalThis.Worker !== 'undefined';
}

// ── requestId generation ───────────────────────────────────────

let nextId = 0;
function generateRequestId(): string {
  return `req_${++nextId}_${Date.now()}`;
}

// ── Worker-backed client ───────────────────────────────────────

function createWorkerClient(workerUrl: URL | string): SearchWorkerClient {
  const WorkerCtor = globalThis.Worker;
  if (!WorkerCtor) {
    throw new WorkerNotSupportedError();
  }

  let worker: Worker;
  try {
    worker = new WorkerCtor(workerUrl, { type: 'module' });
  } catch (err) {
    throw new WorkerInitializationError(err instanceof Error ? err.message : String(err));
  }

  type PendingResolve = (value: void | SearchResponse<QuranText>) => void;
  const pending = new Map<string, { resolve: PendingResolve; reject: (reason: unknown) => void }>();

  worker.onmessage = (event: MessageEvent<WorkerResponse<QuranText>>) => {
    const msg = event.data;

    let requestId: string | undefined;
    if ('requestId' in msg) {
      requestId = msg.requestId;
    }

    if (!requestId) return;

    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);

    switch (msg.type) {
      case 'INIT_DATA_RESULT':
        if (msg.success) {
          entry.resolve(undefined);
        } else {
          entry.reject(new Error(msg.error ?? 'Failed to initialize worker data'));
        }
        break;

      case 'SEARCH_RESULT':
        entry.resolve(msg.data);
        break;

      case 'ERROR':
        entry.reject(new Error(msg.error));
        break;
    }
  };

  worker.onerror = (event) => {
    for (const [, entry] of pending) {
      entry.reject(new WorkerInitializationError(event.message || 'Worker error'));
    }
    pending.clear();
  };

  function post(request: WorkerRequest): void {
    worker.postMessage(request);
  }

  return {
    initData(): Promise<void> {
      const requestId = generateRequestId();
      return new Promise<void>((resolve, reject) => {
        pending.set(requestId, {
          resolve: resolve as PendingResolve,
          reject,
        });
        post({ type: 'INIT_DATA', requestId });
      });
    },

    runSearch(
      query: string,
      options: AdvancedSearchOptions,
      pagination: PaginationOptions,
    ): Promise<SearchResponse> {
      const requestId = generateRequestId();
      return new Promise<SearchResponse>((resolve, reject) => {
        pending.set(requestId, {
          resolve: resolve as PendingResolve,
          reject,
        });
        post({ type: 'RUN_SEARCH', requestId, query, options, pagination });
      });
    },

    terminate(): void {
      post({ type: 'DISPOSE' });
      worker.terminate();
      for (const [, entry] of pending) {
        entry.reject(new WorkerTerminatedError());
      }
      pending.clear();
    },
  };
}

// ── Fallback client (runs search on main thread) ───────────────

export type FallbackDependencies = SearchContext<QuranText>;

function createFallbackClient(deps: FallbackDependencies): SearchWorkerClient {
  let ready = false;
  let lruCache: LRUCache<string, SearchResponse<QuranText>> | null = null;

  return {
    async initData(): Promise<void> {
      lruCache = new LRUCache(100);
      ready = true;
    },

    async runSearch(
      query: string,
      options: AdvancedSearchOptions,
      pagination: PaginationOptions,
    ): Promise<SearchResponse> {
      if (!ready) {
        throw new WorkerNotInitializedError();
      }
      return search(
        query,
        {
          quranData: deps.quranData,
          morphologyMap: deps.morphologyMap,
          wordMap: deps.wordMap,
          invertedIndex: deps.invertedIndex,
          semanticMap: deps.semanticMap,
          phoneticMap: deps.phoneticMap,
        },
        options,
        pagination,
        undefined,
        lruCache ?? undefined,
      );
    },

    terminate(): void {
      lruCache?.clear();
      lruCache = null;
      ready = false;
    },
  };
}

// ── Public factory ─────────────────────────────────────────────

export type CreateSearchWorkerOptions = {
  /**
   * URL (or path) pointing to the compiled search worker script.
   * Required when `Worker` is available. Ignored for fallback mode.
   *
   * Most bundlers support:
   * ```ts
   * new URL('./search-worker.ts', import.meta.url)
   * ```
   */
  workerUrl?: URL | string;

  /**
   * Pre-loaded data to use for the main-thread fallback when
   * Workers are not supported. Ignored when a Worker is available.
   */
  fallbackDeps?: FallbackDependencies;
};

/**
 * Create a `SearchWorkerClient` that delegates search to a Web Worker
 * when available, or falls back to running search on the main thread.
 *
 * ```ts
 * const client = createSearchWorker({
 *   workerUrl: new URL('./search-worker.js', import.meta.url),
 *   fallbackDeps: { quranData, morphologyMap, wordMap },
 * });
 * await client.initData();
 * const results = await client.runSearch(query, options, pagination);
 * ```
 */
export function createSearchWorker(opts: CreateSearchWorkerOptions = {}): SearchWorkerClient {
  if (supportsWorkers() && opts.workerUrl) {
    try {
      return createWorkerClient(opts.workerUrl);
    } catch {
      // Worker creation failed (e.g. CSP restriction); fall through to fallback
    }
  }

  if (opts.fallbackDeps) {
    return createFallbackClient(opts.fallbackDeps);
  }

  throw new WorkerFactoryError('Web Workers not supported and no fallbackDeps provided.');
}
