import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  supportsWorkers,
  createSearchWorker,
  type FallbackDependencies,
} from './search-worker-client';
import { WorkerNotInitializedError, WorkerFactoryError } from '../errors';
import type { QuranText, MorphologyAya, SearchResponse } from '../types';

// ── supportsWorkers ────────────────────────────────────────────

describe('supportsWorkers', () => {
  it('returns true when Worker is defined', () => {
    vi.stubGlobal('Worker', class MockWorker {});
    expect(supportsWorkers()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false when Worker is undefined', () => {
    vi.stubGlobal('Worker', undefined);
    expect(supportsWorkers()).toBe(false);
    vi.unstubAllGlobals();
  });
});

// ── Fallback client ────────────────────────────────────────────

describe('createSearchWorker – fallback mode', () => {
  const minimalVerse: QuranText = {
    gid: 1,
    sura_id: 1,
    aya_id: 1,
    aya_id_display: '1',
    page_id: 1,
    juz_id: 1,
    standard: 'بسم الله الرحمن الرحيم',
    standard_full: 'بسم الله الرحمن الرحيم',
    uthmani: 'بسم الله الرحمن الرحيم',
    sura_name: 'الفاتحة',
    sura_name_en: 'Al-Fatiha',
    sura_name_romanization: 'Al-Fatiha',
  };

  const morphMap = new Map<number, MorphologyAya>([
    [1, { gid: 1, lemmas: ['بسم'], roots: ['سمو'] }],
  ]);

  const wm = new Map<string, { lemma?: string; root?: string }>();

  const deps: FallbackDependencies = {
    quranData: new Map([[1, minimalVerse]]),
    morphologyMap: morphMap,
    wordMap: wm,
  };

  beforeEach(() => {
    vi.stubGlobal('Worker', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when Workers unavailable and no fallbackDeps', () => {
    expect(() => createSearchWorker({})).toThrow(WorkerFactoryError);
  });

  it('creates a fallback client when Workers are unavailable', () => {
    const client = createSearchWorker({ fallbackDeps: deps });
    expect(client).toBeDefined();
    expect(client.initData).toBeInstanceOf(Function);
    expect(client.runSearch).toBeInstanceOf(Function);
    expect(client.terminate).toBeInstanceOf(Function);
  });

  it('fallback runSearch throws before initData', async () => {
    const client = createSearchWorker({ fallbackDeps: deps });
    await expect(
      client.runSearch('test', { lemma: true, root: true }, { page: 1, limit: 10 }),
    ).rejects.toThrow(WorkerNotInitializedError);
  });

  it('fallback client performs search after initData', async () => {
    const client = createSearchWorker({ fallbackDeps: deps });
    await client.initData();

    const result: SearchResponse = await client.runSearch(
      'بسم',
      { lemma: true, root: true },
      { page: 1, limit: 10 },
    );

    expect(result).toBeDefined();
    expect(result.results).toBeInstanceOf(Array);
    expect(result.pagination).toBeDefined();
    expect(result.counts).toBeDefined();
  });

  it('fallback client can be terminated without error', async () => {
    const client = createSearchWorker({ fallbackDeps: deps });
    await client.initData();
    expect(() => client.terminate()).not.toThrow();
  });
});

// ── Worker client (mocked Worker) ──────────────────────────────

describe('createSearchWorker – worker mode', () => {
  type WorkerMessageHandler = (event: { data: unknown }) => void;

  class MockWorker {
    onmessage: WorkerMessageHandler | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    private listeners: Array<WorkerMessageHandler> = [];

    postMessage(data: { type: string; requestId: string }) {
      if (data.type === 'INIT_DATA') {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'INIT_DATA_RESULT',
              requestId: data.requestId,
              success: true,
            },
          });
        }, 0);
      }
      if (data.type === 'RUN_SEARCH') {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'SEARCH_RESULT',
              requestId: data.requestId,
              data: {
                results: [],
                counts: {
                  simple: 0,
                  lemma: 0,
                  root: 0,
                  fuzzy: 0,
                  range: 0,
                  semantic: 0,
                  regex: 0,
                  total: 0,
                },
                pagination: {
                  totalResults: 0,
                  totalPages: 0,
                  currentPage: 1,
                  limit: 10,
                },
              },
              timingMs: 5,
            },
          });
        }, 0);
      }
    }

    terminate() {}
    addEventListener(_: string, fn: WorkerMessageHandler) {
      this.listeners.push(fn);
    }
    removeEventListener() {}
  }

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a worker-backed client when Worker is available and workerUrl is provided', () => {
    const client = createSearchWorker({ workerUrl: 'fake://worker.js' });
    expect(client).toBeDefined();
  });

  it('initData resolves on successful worker response', async () => {
    const client = createSearchWorker({ workerUrl: 'fake://worker.js' });
    await expect(client.initData()).resolves.toBeUndefined();
  });

  it('runSearch resolves with SearchResponse from worker', async () => {
    const client = createSearchWorker({ workerUrl: 'fake://worker.js' });
    await client.initData();

    const result = await client.runSearch(
      'test',
      { lemma: true, root: true },
      { page: 1, limit: 10 },
    );

    expect(result).toBeDefined();
    expect(result.results).toEqual([]);
    expect(result.pagination.currentPage).toBe(1);
  });

  it('terminate does not throw', async () => {
    const client = createSearchWorker({ workerUrl: 'fake://worker.js' });
    expect(() => client.terminate()).not.toThrow();
  });

  it('handles error responses from worker', async () => {
    class ErrorWorker {
      onmessage: WorkerMessageHandler | null = null;
      onerror: ((event: { message: string }) => void) | null = null;
      postMessage(data: { type: string; requestId: string }) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'ERROR',
              requestId: data.requestId,
              error: 'Something went wrong',
            },
          });
        }, 0);
      }
      terminate() {}
    }

    vi.stubGlobal('Worker', ErrorWorker);
    const client = createSearchWorker({ workerUrl: 'fake://worker.js' });
    await expect(client.initData()).rejects.toThrow('Something went wrong');
  });

  it('throws WorkerFactoryError when Worker is undefined and fallbackDeps not provided', () => {
    vi.stubGlobal('Worker', undefined);
    expect(() => createSearchWorker({ workerUrl: 'fake://worker.js' })).toThrow(WorkerFactoryError);
  });

  it('throws WorkerFactoryError when fallbackDeps not provided and Workers unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    expect(() => createSearchWorker({})).toThrow(WorkerFactoryError);
  });
});
