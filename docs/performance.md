# Performance Benchmarking Guide

This guide covers how to measure, profile, and optimize the performance of `quran-search-engine`. It is intended for developers integrating the library into applications and for contributors working on performance improvements.

## Table of Contents

- [1. Benchmarking Guide](#1-benchmarking-guide)
  - [Data Loading](#data-loading)
  - [Search Latency](#search-latency)
  - [Memory Footprint](#memory-footprint)
  - [Full Benchmark Script](#full-benchmark-script)
- [2. LRU Cache Usage](#2-lru-cache-usage)
  - [Why Cache?](#why-cache)
  - [LRU Cache Implementation](#lru-cache-implementation)
  - [Cache Search Results](#cache-search-results)
  - [Cache the Fuse.js Instance](#cache-the-fusejs-instance)
- [3. Inverted Index Optimization](#3-inverted-index-optimization)
  - [Current Architecture](#current-architecture)
  - [Building an Inverted Index](#building-an-inverted-index)
  - [Tradeoffs](#tradeoffs)
- [4. Worker Offloading](#4-worker-offloading)
  - [Why Use Workers?](#why-use-workers)
  - [Search Worker Pattern](#search-worker-pattern)
  - [Main Thread Usage](#main-thread-usage)
  - [Caveats](#caveats)

---

## 1. Benchmarking Guide

### Data Loading

The library loads three JSON datasets at startup via dynamic `import()`. You should measure this once at application initialization:

```typescript
import { loadQuranData, loadMorphology, loadWordMap } from 'quran-search-engine';

async function benchmarkDataLoading() {
  const t0 = performance.now();
  const [quranData, morphologyMap, wordMap] = await Promise.all([
    loadQuranData(),
    loadMorphology(),
    loadWordMap(),
  ]);
  const t1 = performance.now();

  console.log(`Data loading: ${(t1 - t0).toFixed(2)}ms`);
  console.log(`  Quran verses: ${quranData.length}`);        // 6,236
  console.log(`  Morphology entries: ${morphologyMap.size}`); // 6,236
  console.log(`  Word map keys: ${Object.keys(wordMap).length}`);
}
```

Data loading is a **one-time cost**. Load all three datasets once and reuse them across searches.

### Search Latency

Search performance varies significantly based on the options you enable. The `search()` function runs two independent search tracks in parallel and merges their results:

1. **Simple search** — `simpleSearch()` performs a linear scan with `Array.filter()` over all 6,236 verses, matching normalized tokens against the `standard` field
2. **Advanced linguistic search** — `performAdvancedLinguisticSearch()` iterates over all 6,236 verses per query token, checking lemma and root matches via the morphology map. For tokens with no linguistic match, it falls back to fuzzy search if enabled

The results from both tracks are combined, deduplicated by verse GID, scored, and sorted by relevance.

When `fuzzy` is enabled (the default), a new [Fuse.js](https://www.fusejs.io/) index is constructed on every `search()` call. This is the most expensive operation per call.

Benchmark different option combinations:

```typescript
import { search } from 'quran-search-engine';
import type { QuranText, MorphologyAya, WordMap } from 'quran-search-engine';

function benchmarkSearch(
  quranData: QuranText[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
) {
  const queries = ['الله', 'كتب', 'الله الرحمن'];
  const configs = [
    { label: 'Simple only',           opts: { lemma: false, root: false, fuzzy: false } },
    { label: 'Lemma + Root',          opts: { lemma: true,  root: true,  fuzzy: false } },
    { label: 'Lemma + Root + Fuzzy',  opts: { lemma: true,  root: true,  fuzzy: true  } },
  ];

  for (const { label, opts } of configs) {
    console.log(`\n--- ${label} ---`);
    for (const q of queries) {
      const start = performance.now();
      const response = search(q, quranData, morphologyMap, wordMap, opts);
      const elapsed = performance.now() - start;
      console.log(
        `  "${q}": ${elapsed.toFixed(2)}ms (${response.pagination.totalResults} results)`,
      );
    }
  }
}
```

Approximate timings (will vary by hardware):

| Configuration | Single-word query | Multi-word query | Notes |
|---------------|-------------------|------------------|-------|
| Simple only | 5–20 ms | 10–30 ms | Linear scan, no index overhead |
| Lemma + Root | 20–80 ms | 40–150 ms | Scans all 6,236 verses per token |
| Lemma + Root + Fuzzy | 100–500 ms | 200–800 ms | Fuse.js index rebuilt per call |

> **Always measure on your own hardware.** The code examples above give you the tools to do so.

### Memory Footprint

#### Node.js

```typescript
function benchmarkMemory() {
  const before = process.memoryUsage();
  // ... load data or run search ...
  const after = process.memoryUsage();

  const delta = (after.heapUsed - before.heapUsed) / 1024 / 1024;
  console.log(`Heap increase: ${delta.toFixed(2)} MB`);
  console.log(`Total heap used: ${(after.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}
```

#### Browser (Chrome DevTools)

```typescript
// Chrome-only, non-standard API
if ('memory' in performance) {
  const mem = (performance as any).memory;
  console.log(`JS Heap: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`JS Heap limit: ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
}
```

For cross-browser profiling, use the **Memory** tab in Chrome DevTools to take heap snapshots before and after loading data.

### Full Benchmark Script

Here is a complete Node.js benchmark you can run with `npx tsx`:

```typescript
// benchmark.ts
import { loadQuranData, loadMorphology, loadWordMap, search } from 'quran-search-engine';

async function main() {
  // --- Data Loading ---
  const memBefore = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const [quranData, morphologyMap, wordMap] = await Promise.all([
    loadQuranData(),
    loadMorphology(),
    loadWordMap(),
  ]);
  const loadTime = performance.now() - t0;
  const memAfter = process.memoryUsage().heapUsed;

  console.log('=== Data Loading ===');
  console.log(`  Time: ${loadTime.toFixed(2)}ms`);
  console.log(`  Memory: ${((memAfter - memBefore) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Verses: ${quranData.length}`);

  // --- Search Benchmarks ---
  const queries = ['الله', 'كتب', 'رحم', 'نار جهنم'];
  const runs = 5; // Average over multiple runs

  const configs = [
    { label: 'Simple only',  opts: { lemma: false, root: false, fuzzy: false } },
    { label: 'Lemma + Root', opts: { lemma: true,  root: true,  fuzzy: false } },
    { label: 'Full (fuzzy)', opts: { lemma: true,  root: true                } },
  ];

  console.log('\n=== Search Latency (avg of 5 runs) ===');
  for (const { label, opts } of configs) {
    console.log(`\n  ${label}:`);
    for (const q of queries) {
      let total = 0;
      let resultCount = 0;
      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        const res = search(q, quranData, morphologyMap, wordMap, opts);
        total += performance.now() - start;
        resultCount = res.pagination.totalResults;
      }
      console.log(`    "${q}": ${(total / runs).toFixed(2)}ms avg (${resultCount} results)`);
    }
  }
}

main();
```

Run it:

```bash
npx tsx benchmark.ts
```

---

## 2. LRU Cache Usage

### Why Cache?

The library is **stateless by design** — it does not maintain internal caches. This means:

- Every `search()` call re-runs the full pipeline (normalize, scan, score, sort)
- When `fuzzy` is enabled (the default), a new Fuse.js index is built on every call
- Repeated identical queries pay the full cost each time

For applications with repeated or similar queries (autocomplete, typeahead, paginating through results), adding a consumer-side cache can dramatically reduce latency.

### LRU Cache Implementation

A simple LRU (Least Recently Used) cache using the built-in `Map` (which maintains insertion order):

```typescript
class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### Cache Search Results

Cache results keyed by query + options to avoid re-executing identical searches:

```typescript
import { search } from 'quran-search-engine';
import type {
  QuranText, MorphologyAya, WordMap, SearchResponse, SearchOptions,
} from 'quran-search-engine';

const searchCache = new LRUCache<string, SearchResponse>(100);

function cachedSearch(
  query: string,
  quranData: QuranText[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: SearchOptions,
): SearchResponse {
  const cacheKey = `${query}|${options.lemma}|${options.root}|${options.fuzzy ?? true}`;

  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const result = search(query, quranData, morphologyMap, wordMap, options);
  searchCache.set(cacheKey, result);
  return result;
}
```

This is especially effective for:

- **Autocomplete/typeahead** — users often re-type the same prefix
- **Pagination** — cache the full result set, then slice client-side
- **Back navigation** — returning to a previous search result

### Cache the Fuse.js Instance

The most impactful single optimization. Currently, `search()` creates a new Fuse.js instance on every call when `fuzzy` is enabled. If you are making multiple searches against the same dataset, you can pre-build the Fuse instance once:

```typescript
import Fuse from 'fuse.js';
import type { QuranText } from 'quran-search-engine';

// Build once at startup
function createReusableFuseIndex(quranData: QuranText[]): Fuse<QuranText> {
  return new Fuse(quranData, {
    includeScore: true,
    includeMatches: true,
    threshold: 0.5,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 3,
    useExtendedSearch: true,
    keys: ['standard', 'uthmani'],
  });
}
```

> **Important:** The library's `search()` function always builds its own Fuse index internally — there is no way to pass a pre-built instance into `search()`. This means you cannot use the index above as a drop-in optimization with the existing API. To use a pre-built Fuse index, you would have to call `fuse.search()` directly and handle scoring, pagination, and lemma/root matching yourself (bypassing the library's `search()` function). This pattern is documented for **contributors** considering adding pre-built index support to the library as a future enhancement.

---

## 3. Inverted Index Optimization

### Current Architecture

The library currently uses **linear scans** for matching:

- `simpleSearch()` calls `Array.filter()` over all 6,236 verses for each query
- `performAdvancedLinguisticSearch()` iterates over all 6,236 verses per query token, using `morphologyMap.get(verse.gid)` (O(1)) to check each verse's lemmas and roots
- The morphology data is stored as a `Map<number, MorphologyAya>` enabling O(1) per-verse lookup, but finding all verses that contain a specific lemma or root still requires iterating the full verse list since there is no reverse index

This means search complexity is approximately **O(V × T)** where V = 6,236 verses and T = number of query tokens.

### Building an Inverted Index

An inverted index maps each token/lemma/root to the set of verse GIDs that contain it, enabling O(1) lookup per token:

```typescript
import { normalizeArabic } from 'quran-search-engine';
import type { QuranText, MorphologyAya } from 'quran-search-engine';

type InvertedIndex = {
  tokenToGids: Map<string, Set<number>>;
  lemmaToGids: Map<string, Set<number>>;
  rootToGids: Map<string, Set<number>>;
};

function buildInvertedIndex(
  quranData: QuranText[],
  morphologyMap: Map<number, MorphologyAya>,
): InvertedIndex {
  const tokenToGids = new Map<string, Set<number>>();
  const lemmaToGids = new Map<string, Set<number>>();
  const rootToGids = new Map<string, Set<number>>();

  for (const verse of quranData) {
    // Index normalized tokens from the standard text
    const words = normalizeArabic(verse.standard).split(/\s+/);
    for (const word of words) {
      if (!tokenToGids.has(word)) tokenToGids.set(word, new Set());
      tokenToGids.get(word)!.add(verse.gid);
    }

    // Index lemmas and roots from morphology
    const morph = morphologyMap.get(verse.gid);
    if (morph) {
      for (const lemma of morph.lemmas) {
        const normalized = normalizeArabic(lemma);
        if (!lemmaToGids.has(normalized)) lemmaToGids.set(normalized, new Set());
        lemmaToGids.get(normalized)!.add(verse.gid);
      }
      for (const root of morph.roots) {
        const normalized = normalizeArabic(root);
        if (!rootToGids.has(normalized)) rootToGids.set(normalized, new Set());
        rootToGids.get(normalized)!.add(verse.gid);
      }
    }
  }

  return { tokenToGids, lemmaToGids, rootToGids };
}
```

With this index, finding all verses containing a token becomes:

```typescript
const gids = index.tokenToGids.get(normalizeArabic('الله'));
// Returns Set<number> of matching verse GIDs — O(1) lookup
```

### Tradeoffs

| Aspect | Without Index (current) | With Inverted Index |
|--------|------------------------|---------------------|
| Startup time | Fast (data loading only) | +50–200 ms for index build |
| Memory | Base dataset only | +5–15 MB for index maps |
| Per-query (exact) | O(6,236) linear scan | O(1) lookup |
| Per-query (lemma/root) | O(6,236) per token | O(1) lookup |
| Flexibility | Can match substrings | Exact token matches only |

The inverted index is a **one-time build cost** that pays off when you have multiple searches. For single-search use cases (like a static page), the linear scan may be sufficient.

> **Note:** This is a consumer-side optimization pattern. The library does not currently include an inverted index. This pattern is documented for contributors considering this as a future enhancement.

---

## 4. Worker Offloading

### Why Use Workers?

The `search()` function is **synchronous and CPU-bound**. With fuzzy search enabled, a single call can take 100–500 ms, which blocks the main thread and causes UI jank (dropped frames, unresponsive input).

Web Workers run in a separate thread, keeping the UI responsive during search operations.

The library has **no DOM dependencies**, making it ideal for Worker offloading.

### Search Worker Pattern

Create a worker that loads the data once and handles search requests:

```typescript
// search.worker.ts
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  search,
} from 'quran-search-engine';
import type {
  QuranText,
  MorphologyAya,
  WordMap,
  SearchOptions,
  PaginationOptions,
  SearchResponse,
} from 'quran-search-engine';

let quranData: QuranText[];
let morphologyMap: Map<number, MorphologyAya>;
let wordMap: WordMap;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  if (type === 'init') {
    [quranData, morphologyMap, wordMap] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
    ]);
    self.postMessage({ type: 'ready', id });
  }

  if (type === 'search') {
    const { query, options, pagination } = payload as {
      query: string;
      options: SearchOptions;
      pagination?: PaginationOptions;
    };
    const response: SearchResponse = search(
      query,
      quranData,
      morphologyMap,
      wordMap,
      options,
      pagination,
    );
    self.postMessage({ type: 'results', payload: response, id });
  }
};
```

### Main Thread Usage

```typescript
// main.ts
const worker = new Worker(
  new URL('./search.worker.ts', import.meta.url),
  { type: 'module' },
);

// Initialize — loads data inside the worker
worker.postMessage({ type: 'init', id: 'init-1' });

worker.onmessage = (e) => {
  const { type, payload, id } = e.data;

  if (type === 'ready') {
    console.log('Search engine ready in worker');
  }

  if (type === 'results') {
    console.log(`Search results for request ${id}:`, payload);
    // Update your UI here
  }
};

// Run a search (non-blocking)
worker.postMessage({
  type: 'search',
  id: 'search-1',
  payload: {
    query: 'الله',
    options: { lemma: true, root: true },
    pagination: { page: 1, limit: 20 },
  },
});
```

### Caveats

- **Load data inside the worker.** Transferring the full quranData array (6,236 objects) via `postMessage` would be slow due to structured cloning. Let the worker load the JSON datasets directly.
- **Search results are small.** The paginated response (default 20 results) transfers back to the main thread with negligible cost.
- **Bundler support.** The `new URL('./worker.ts', import.meta.url)` pattern works with Vite, Webpack 5+, and Next.js. For older bundlers, consult their Web Worker documentation.
- **No shared state.** The worker holds its own copy of the data. If you need multiple workers (e.g., for concurrent queries), each will load its own data copy and use proportionally more memory.
- **Related issue:** See [#12 — Web Worker Offloading](https://github.com/adelpro/quran-search-engine/issues/12) for the tracked feature request to add built-in worker support to the library.
