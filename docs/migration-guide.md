# Migration Guide: Upgrading to v0.3.x

This guide helps you migrate your application from v0.1.x/v0.2.x to the new v0.3.x architecture in `quran-search-engine`.

## Overview of Breaking Changes

Version 0.3.x introduces significant architectural changes including:

- **Search Context Pattern**: Replaced positional arguments with a structured context object
- **Map-based Data Structures**: `quranData` is now a `Map<number, TVerse>` instead of an array
- **Inverted Index Required**: You must build and pass an inverted index for search
- **Removed Features**: Phonetic search index, English-to-Arabic search, lemma/root/word index files

---

## Breaking Changes

### 1. `quranData` is Now a Map

**Old (v0.1.x/v0.2.x):**

```typescript
const [quranData, setQuranData] = useState<QuranText[]>([]);
```

**New (v0.3.x):**

```typescript
const [quranData, setQuranData] = useState<Map<number, QuranText> | null>(null);
```

### 2. `search()` Function Signature Changed

The `search()` function now uses a **Search Context Pattern** instead of positional arguments.

**Old (v0.1.x/v0.2.x):**

```typescript
const response = search(
  query,
  quranData,           // QuranText[]
  morphologyMap,       // Map<number, MorphologyAya>
  wordMap,             // WordMap
  options,             // SearchOptions
  { page, limit },     // PaginationOptions
  undefined,           // Previously unused
  searchCache,          // LRUCache
);
```

**New (v0.3.x):**

```typescript
const response = search(
  query,                                                    // string
  {
    quranData,           // Map<number, TVerse>
    morphologyMap,       // Map<number, MorphologyAya>
    wordMap,             // WordMap
    invertedIndex,       // InvertedIndex (required)
    semanticMap,         // Map<string, string[]> (optional)
    phoneticMap,         // Map<string, string[]> (optional)
  },
  options,             // SearchOptions
  { page, limit },     // PaginationOptions
  undefined,           // Unused
  searchCache,          // LRUCache
);
```

### 3. Inverted Index is Now Required

You must build the inverted index before searching.

**Old (v0.1.x/v0.2.x):**

```typescript
// No inverted index needed
```

**New (v0.3.x):**

```typescript
import { buildInvertedIndex, loadSemanticData, loadSubjectData } from 'quran-search-engine';

const semanticMap = await loadSemanticData();
const invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap);
```

### 4. Data Loading Changes

**Old (v0.1.x/v0.2.x):**

```typescript
const [data, morphology, dictionary] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);
```

**New (v0.3.x):**

```typescript
const [data, morphology, dictionary, semantic] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),  // New! Required for inverted index
]);
```

### 5. Worker Initialization Changed

**Old (v0.1.x/v0.2.x):**

```typescript
const client = createSearchWorker({
  workerUrl: new URL('quran-search-engine/worker', import.meta.url),
});
await client.initData();
```

**New (v0.3.x):**

```typescript
// Dynamic import for worker URL
const mod = await import('quran-search-engine/worker?url');
const client = createSearchWorker({ workerUrl: mod.default });
await client.initData();
```

### 6. Worker Client Type Renamed

**Old (v0.1.x/v0.2.x):**

```typescript
import type { SearchWorkerClient } from 'quran-search-engine';
```

**New (v0.3.x):**

```typescript
// Still imported as SearchWorkerClient, but implementation is now simpler
import type { SearchWorkerClient } from 'quran-search-engine';
```

### 7. Removed Features

The following have been removed in v0.3.x:

| Feature | Removed | Alternative |
|---------|---------|-------------|
| Phonetic Search | `loadPhoneticData()` | Use exact Arabic text search |
| English-to-Arabic Search | `loadEnglishToArabic()` | Semantic search with English concepts |
| Lemma Index | `lemma-index.json` | Use semantic search instead |
| Root Index | `root-index.json` | Use semantic search instead |
| Word Index | `word-index.json` | Use semantic search instead |

### 8. File Naming Convention

Error files now use kebab-case:

| Old | New |
|-----|-----|
| `base.error.ts` | `base-error.ts` |
| `search.error.ts` | `search-error.ts` |
| `validation.error.ts` | `validation-error.ts` |
| `tokenization.error.ts` | `tokenization-error.ts` |

---

## Migration Steps

### Step 1: Update Data State

Change `quranData` from array to Map:

```typescript
const [quranData, setQuranData] = useState<Map<number, QuranText> | null>(null);
const [invertedIndex, setInvertedIndex] = useState<InvertedIndex | null>(null);
const [semanticMap, setSemanticMap] = useState<Map<string, string[]> | null>(null);
```

### Step 2: Build Inverted Index After Loading

```typescript
const [data, morphology, dictionary, semantic] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
]);

setQuranData(data);
setMorphologyMap(morphology);
setWordMap(dictionary);
setSemanticMap(semantic);

// Build inverted index
const subjectMap = await loadSubjectData();
const index = buildInvertedIndex(morphology, data, semantic, subjectMap);
setInvertedIndex(index);
```

### Step 3: Update Search Call

```typescript
const response = search(
  debouncedQuery,
  {
    quranData: quranData,
    morphologyMap: morphologyMap,
    wordMap: wordMap,
    invertedIndex: invertedIndex,
    semanticMap: semanticMap,
  },
  options,
  { page: currentPage, limit: PAGE_SIZE },
  undefined,
  searchCache,
);
```

### Step 4: Update Worker Initialization (if using workers)

```typescript
let workerUrl: string | null = null;

async function loadWorkerUrl() {
  if (!workerUrl) {
    const mod = await import('quran-search-engine/worker?url');
    workerUrl = mod.default;
  }
  return workerUrl;
}

// Then when initializing:
const url = await loadWorkerUrl();
const client = createSearchWorker({ workerUrl: url });
await client.initData();
```

### Step 5: Remove Phonetic Options (if present)

Remove any references to `loadPhoneticData()` and phonetic search options:

```typescript
// REMOVED - no longer needed
const phoneticMap = await loadPhoneticData();
```

---

## New Features in v0.3.x

### Worker Status Tracking

You can now track whether search runs on a worker or main thread:

```typescript
const [usingWorker, setUsingWorker] = useState<boolean | null>(null);

// In search effect:
setUsingWorker(true);  // or false for main thread
```

### Inverted Index Statistics

Track index build performance:

```typescript
const [indexStats, setIndexStats] = useState<{
  lemmaCount: number;
  rootCount: number;
  wordCount: number;
  semanticCount: number;
} | null>(null);
const [indexBuildTime, setIndexBuildTime] = useState<number | null>(null);

const buildStart = performance.now();
const subjectMap = await loadSubjectData();
const index = buildInvertedIndex(morphologyMap, quranData, semanticMap, subjectMap);
const buildMs = performance.now() - buildStart;

setIndexStats({
  lemmaCount: index.lemmaIndex.size,
  rootCount: index.rootIndex.size,
  wordCount: index.wordIndex.size,
  semanticCount: index.semanticIndex?.size ?? 0,
});
setIndexBuildTime(buildMs);
```

### WorkerError Class

New error handling for worker-related errors:

```typescript
import { WorkerError, ErrorCode } from 'quran-search-engine';

try {
  await client.runSearch(query, options, pagination);
} catch (error) {
  if (error instanceof WorkerError) {
    console.error('Worker error:', error.code, error.message);
  }
}
```

---

## Complete Migration Example

**Before (v0.2.x):**

```typescript
const [quranData, setQuranData] = useState<QuranText[]>([]);
const [morphologyMap, setMorphologyMap] = useState<Map<number, MorphologyAya> | null>(null);
const [wordMap, setWordMap] = useState<WordMap | null>(null);

useEffect(() => {
  async function init() {
    const [data, morphology, dictionary] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
    ]);
    setQuranData(data);
    setMorphologyMap(morphology);
    setWordMap(dictionary);
  }
  init();
}, []);

const response = search(
  query,
  quranData,
  morphologyMap!,
  wordMap!,
  options,
  { page: 1, limit: 10 },
  undefined,
  searchCache,
);
```

**After (v0.3.x):**

```typescript
const [quranData, setQuranData] = useState<Map<number, QuranText> | null>(null);
const [morphologyMap, setMorphologyMap] = useState<Map<number, MorphologyAya> | null>(null);
const [wordMap, setWordMap] = useState<WordMap | null>(null);
const [semanticMap, setSemanticMap] = useState<Map<string, string[]> | null>(null);
const [invertedIndex, setInvertedIndex] = useState<InvertedIndex | null>(null);

useEffect(() => {
  async function init() {
    const [data, morphology, dictionary, semantic] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
      loadSemanticData(),
    ]);
    setQuranData(data);
    setMorphologyMap(morphology);
    setWordMap(dictionary);
    setSemanticMap(semantic);

    const subjectMap = await loadSubjectData();
const index = buildInvertedIndex(morphology, data, semantic, subjectMap);
    setInvertedIndex(index);
  }
  init();
}, []);

const response = search(
  query,
  {
    quranData: quranData,
    morphologyMap: morphologyMap,
    wordMap: wordMap,
    invertedIndex: invertedIndex,
    semanticMap: semanticMap,
  },
  options,
  { page: 1, limit: 10 },
  undefined,
  searchCache,
);
```

---

## Need Help?

If you encounter issues during migration, please [open an issue](https://github.com/adelpro/quran-search-engine/issues) or reach out to the community.
