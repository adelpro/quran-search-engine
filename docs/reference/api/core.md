# Core API Reference

The `quran-search-engine` library exposes several functions and types for loading data, normalizing Arabic text, and performing searches. Everything documented here is exported from `quran-search-engine`.

## Data Loading

> **Note**: The bundled morphology logic and data (lemmas, roots) depend heavily on shapes imported from datasets like the Quranic Arabic Corpus.

### `loadQuranData()`

**Description:** Loads the primary text dataset for the Quran. This should ideally be called once at application startup.

**Returns:** `Promise<QuranText[]>`

```typescript
import { loadQuranData, type QuranText } from 'quran-search-engine';

const quranData: QuranText[] = await loadQuranData();
```

### `loadMorphology()`

**Description:** Loads the morphology mapping which enables Lemma and Root matching and scoring.

**Returns:** `Promise<Map<number, MorphologyAya>>`

```typescript
import { loadMorphology, type MorphologyAya } from 'quran-search-engine';

const morphologyMap: Map<number, MorphologyAya> = await loadMorphology();
```

### `loadWordMap()`

**Description:** Loads the token mapping to canonical lemmas/roots. This maps normalized query tokens back to their base forms.

**Returns:** `Promise<WordMap>`

```typescript
import { loadWordMap, type WordMap } from 'quran-search-engine';

const wordMap: WordMap = await loadWordMap();
```

### `loadSemanticData()`

**Description:** Loads the semantic mapping data for concept-based search. Maps normalized concepts to arrays of verse GIDs containing semantically related words.

**Returns:** `Promise<Map<string, string[]>>`

```typescript
import { loadSemanticData } from 'quran-search-engine';

const semanticMap = await loadSemanticData();
```

### `loadPhoneticData()`

**Description:** Loads the phonetic dictionary for Latin-to-Arabic transliteration search. Maps phonetic spellings (e.g., "Bismillah") to their Arabic equivalents.

**Returns:** `Promise<Map<string, string[]>>`

```typescript
import { loadPhoneticData } from 'quran-search-engine';

const phoneticMap = await loadPhoneticData();
```

### Data Validation

To ensure custom datasets map cleanly to `SearchOptions` operations seamlessly, native validators are exposed for internal schemas.

#### Validation Functions

| Function                       | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `validateQuranData(data)`      | Validates verse data against `VerseInput` schema |
| `validateMorphologyData(data)` | Validates morphology array structure             |
| `validateWordMapData(data)`    | Validates word map dictionary                    |
| `validateSemanticData(data)`   | Validates semantic mapping data                  |

**Returns:** `ValidationResult` containing `valid` boolean and `errors` array.

```typescript
import { validateQuranData, formatSchemaErrors } from 'quran-search-engine';

const validationResult = validateQuranData(customQuranArray);
if (!validationResult.valid) {
  console.error(formatSchemaErrors(validationResult));
}
```

#### Validation Types

```typescript
type SchemaError = {
  /** Dot-path to the offending field, e.g. "verses[0].gid" */
  path: string;
  /** Human-readable explanation */
  message: string;
};

type ValidationResult = {
  valid: boolean;
  errors: SchemaError[];
};
```

#### `formatSchemaErrors(result)`

**Description:** Formats a `ValidationResult` into a human-readable string for logging or display.

```typescript
import { formatSchemaErrors } from 'quran-search-engine';

const result = validateQuranData(data);
console.log(formatSchemaErrors(result));
// Output:
//   1. [verses[0].gid] Expected number, received string
//   2. [verses[1].standard] Required field missing
```

---

## Error Handling

The library provides a hierarchical error system for granular error handling. All errors extend `BaseError` and include `code`, `type`, and `message` properties.

### Data Loading Errors

#### `DataLoadError`

Base class for all data loading errors.

```typescript
import { DataLoadError } from 'quran-search-engine';

try {
  // load data...
} catch (e) {
  if (e instanceof DataLoadError) {
    console.log(e.filePath); // The file that failed to load
    console.log(e.cause); // The underlying error
  }
}
```

#### `DataFileNotFoundError`

Thrown when a required data file cannot be found.

```typescript
import { DataFileNotFoundError } from 'quran-search-engine';

try {
  // load data...
} catch (e) {
  if (e instanceof DataFileNotFoundError) {
    console.log(e.filePath); // Path to missing file
  }
}
```

#### `DataParseError`

Thrown when a data file exists but cannot be parsed.

```typescript
import { DataParseError } from 'quran-search-engine';
```

#### `DataSchemaInvalidError`

Thrown when parsed data doesn't match the expected schema structure.

```typescript
import { DataSchemaInvalidError } from 'quran-search-engine';

try {
  // load data...
} catch (e) {
  if (e instanceof DataSchemaInvalidError) {
    // e.message includes details about the schema violation
  }
}
```

### Search Errors

#### `InvalidQueryError`

Thrown when the search query is invalid or empty.

```typescript
import { InvalidQueryError } from 'quran-search-engine';

try {
  search('', context); // Throws InvalidQueryError
} catch (e) {
  if (e instanceof InvalidQueryError) {
    console.log(e.query); // The invalid query string
  }
}
```

#### `MissingDependenciesError`

Thrown when required data (quranData, morphologyMap, wordMap) is not loaded.

```typescript
import { MissingDependenciesError } from 'quran-search-engine';

try {
  search('test', { quranData: undefined }); // Throws MissingDependenciesError
} catch (e) {
  if (e instanceof MissingDependenciesError) {
    console.log(e.missingDependencies); // ['quranData']
  }
}
```

#### `InvalidRegexError`

Thrown when a regex pattern is invalid or unsafe (ReDoS risk).

```typescript
import { InvalidRegexError } from 'quran-search-engine';

try {
  search('pattern', context, { isRegex: true });
} catch (e) {
  if (e instanceof InvalidRegexError) {
    console.log(e.pattern); // The problematic pattern
    console.log(e.reason); // Why it was rejected
  }
}
```

### Validation Errors

#### `InvalidPaginationError`

Thrown when pagination parameters are invalid.

```typescript
import { InvalidPaginationError } from 'quran-search-engine';

try {
  search('test', context, {}, { page: -1 }); // Throws InvalidPaginationError
} catch (e) {
  if (e instanceof InvalidPaginationError) {
    console.log(e.page); // The invalid page number
    console.log(e.limit); // The invalid limit
  }
}
```

#### `InvalidOptionsError`

Thrown when search options contain invalid values.

```typescript
import { InvalidOptionsError } from 'quran-search-engine';

try {
  new LRUCache(-5); // Throws InvalidOptionsError
} catch (e) {
  if (e instanceof InvalidOptionsError) {
    console.log(e.reason); // Explanation of the issue
  }
}
```

### Tokenization Errors

#### `MissingMorphologyError`

Thrown when morphology data is missing for a specific verse.

```typescript
import { MissingMorphologyError } from 'quran-search-engine';
```

#### `InvalidModeError`

Thrown when an invalid tokenization mode is provided.

```typescript
import { InvalidModeError } from 'quran-search-engine';

try {
  tokenize('text', 'invalidMode'); // Throws InvalidModeError
} catch (e) {
  if (e instanceof InvalidModeError) {
    console.log(e.mode); // The invalid mode string
  }
}
```

### Worker Errors

#### `WorkerNotSupportedError`

Thrown when Web Workers are not available in the environment.

```typescript
import { WorkerNotSupportedError } from 'quran-search-engine';

try {
  createSearchWorker({ workerUrl: '/worker.js' });
} catch (e) {
  if (e instanceof WorkerNotSupportedError) {
    // Browser doesn't support Workers
  }
}
```

#### `WorkerInitializationError`

Thrown when worker creation fails (e.g., CSP restriction, invalid URL).

```typescript
import { WorkerInitializationError } from 'quran-search-engine';

try {
  createSearchWorker({ workerUrl: '/invalid/path.js' });
} catch (e) {
  if (e instanceof WorkerInitializationError) {
    console.log(e.message); // Details about the failure
  }
}
```

#### `WorkerTerminatedError`

Thrown when an active worker is unexpectedly terminated.

```typescript
import { WorkerTerminatedError } from 'quran-search-engine';
```

#### `WorkerNotInitializedError`

Thrown when calling `runSearch()` before `initData()`.

```typescript
import { WorkerNotInitializedError } from 'quran-search-engine';

const client = createSearchWorker({ fallbackDeps });
await client.runSearch('test'); // Throws WorkerNotInitializedError
```

#### `WorkerFactoryError`

Thrown when `createSearchWorker()` cannot create a client.

```typescript
import { WorkerFactoryError } from 'quran-search-engine';

try {
  createSearchWorker({}); // Workers unavailable, no fallback provided
} catch (e) {
  if (e instanceof WorkerFactoryError) {
    console.log(e.message);
  }
}
```

### Error Code Reference

Each error class has a unique error code:

| Error Code                        | Thrown By                    |
| --------------------------------- | ---------------------------- |
| `DATA_FILE_NOT_FOUND`             | `DataFileNotFoundError`      |
| `DATA_PARSE_ERROR`                | `DataParseError`             |
| `DATA_SCHEMA_INVALID`             | `DataSchemaInvalidError`     |
| `SEARCH_INVALID_QUERY`            | `InvalidQueryError`          |
| `SEARCH_MISSING_DEPENDENCIES`     | `MissingDependenciesError`   |
| `SEARCH_OPERATION_FAILED`         | `SearchOperationFailedError` |
| `SEARCH_INVALID_REGEX`            | `InvalidRegexError`          |
| `VALIDATION_INVALID_PAGINATION`   | `InvalidPaginationError`     |
| `VALIDATION_INVALID_OPTIONS`      | `InvalidOptionsError`        |
| `TOKENIZATION_MISSING_MORPHOLOGY` | `MissingMorphologyError`     |
| `TOKENIZATION_INVALID_MODE`       | `InvalidModeError`           |
| `WORKER_NOT_SUPPORTED`            | `WorkerNotSupportedError`    |
| `WORKER_INITIALIZATION_FAILED`    | `WorkerInitializationError`  |
| `WORKER_TERMINATED`               | `WorkerTerminatedError`      |
| `WORKER_NOT_INITIALIZED`          | `WorkerNotInitializedError`  |
| `WORKER_FACTORY_ERROR`            | `WorkerFactoryError`         |

---

## Constants

### `SURAS`

**Description:** A pre-built Map containing all 114 Surahs of the Quran with metadata including names, verse counts, and page ranges.

**Returns:** `Map<number, Sura>`

```typescript
import { SURAS } from 'quran-search-engine';

const alBaqarah = SURAS.get(2);
console.log(alBaqarah);
// {
//   id: 2,
//   sura_name: 'البقرة',
//   sura_name_en: 'Al-Baqarah',
//   sura_name_romanization: 'Al-Baqarah',
//   total_verses: 286,
//   juz_ids: [1, 2, 3],
//   page_start: 1,
//   page_end: 141
// }

// Iterate all surahs
SURAS.forEach((sura) => {
  console.log(`${sura.id}: ${sura.sura_name_en} (${sura.total_verses} verses)`);
});
```

### `Sura` Type

```typescript
interface Sura {
  id: number;
  sura_name: string;
  sura_name_en: string;
  sura_name_romanization: string;
  total_verses: number;
  juz_ids: number[];
  page_start: number;
  page_end?: number;
}
```

---

## Normalization Functions

These utilities prepare input for searching and display.

### `removeTashkeel(text: string)`

**Description:** Strips Arabic diacritics (tashkeel). Useful for simple comparisons or display sanitization.

**Returns:** `string`

```typescript
import { removeTashkeel } from 'quran-search-engine';

const plain = removeTashkeel('بِسْمِ ٱللَّهِ'); // Returns: 'بسم الله'
```

### `normalizeArabic(text: string)`

**Description:** Prepares raw user input or raw data strings for searching. This unified function strips tashkeel and harmonizes alef variants.

**Returns:** `string`

```typescript
import { normalizeArabic } from 'quran-search-engine';

const normalized = normalizeArabic('بِسْمِ ٱللَّهِ'); // Returns: 'بسم الله'
```

### `isArabic(text: string)`

**Description:** Detects whether a string contains Arabic script. Useful for conditional UI rendering or routing between Arabic and non-Arabic search pipelines.

**Returns:** `boolean`

```typescript
import { isArabic } from 'quran-search-engine';

isArabic('الله'); // true
isArabic('بِسْمِ ٱللَّهِ'); // true
isArabic('Peace'); // false
isArabic('123'); // false
```

### `LRUCache<K, V>`

**Description:** Generic Least Recently Used cache with configurable capacity. Used to cache search results and avoid redundant computation. Pass as the `cache` parameter to `search()`.

**Constructor:** `new LRUCache(capacity: number)`

| Method            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `get(key)`        | Retrieve value, marks key as recently used             |
| `set(key, value)` | Store value, evicts least recently used if at capacity |
| `has(key)`        | Check if key exists                                    |
| `delete(key)`     | Remove entry                                           |
| `clear()`         | Clear all entries                                      |
| `size`            | Number of entries                                      |

```typescript
import { search, LRUCache } from 'quran-search-engine';

const cache = new LRUCache<string, SearchResponse>(100);

const result = search(
  'الله',
  { quranData, morphologyMap, wordMap },
  { lemma: true },
  { page: 1, limit: 10 },
  undefined,
  cache, // 6th parameter — results are cached
);
```

### `createArabicFuseSearch(collection, keys, options?)`

**Description:** Creates a pre-configured Fuse.js search instance optimized for Arabic text. This is useful when you need to reuse the same Fuse index across multiple searches without rebuilding it each time. Pass as the `fuseIndex` parameter to `search()`.

**Parameters:**

- `collection` (array): The data array to search through (e.g., verses).
- `keys` (string[]): The object properties to index for searching.
- `options` (`FuseOptions`, optional): Override any Fuse.js default settings.

**Returns:** A configured `Fuse<T>` instance ready for searching.

**Configuration defaults:**

- `threshold: 0.5` — Moderate typo tolerance while keeping results relevant
- `distance: 100` — Allows matches anywhere in text without position penalty
- `minMatchCharLength: 3` — Ignores common short Arabic particles (من, ال, في)
- `ignoreLocation: true` — Matches can appear anywhere in the text
- `useExtendedSearch: true` — Enables extended search syntax

```typescript
import { createArabicFuseSearch, search } from 'quran-search-engine';

// Create a reusable Fuse index
const fuseIndex = createArabicFuseSearch(verses, ['standard', 'translation']);

// Use the pre-built index for faster searches
const result = search(
  'الله',
  { quranData, morphologyMap, wordMap },
  { lemma: true, root: true },
  { page: 1, limit: 10 },
  fuseIndex, // 5th parameter — use pre-built index
);

// Search directly with the Fuse instance
const fuseResults = fuseIndex.search('الرحمن');
```

---

## Searching

### `search(query, context, options?, pagination?, fuseIndex?, cache?)`

**Description:** The main entry point for querying the engine. Combines Exact, Lemma, Root, and Fuzzy matching dynamically based on the provided tokens.

**Parameters:**

- `query` (string): The search query (can be multi-word).
- `context` (`SearchContext`): Object containing `quranData`, `morphologyMap`, `wordMap`, and optionally `invertedIndex`, `semanticMap`, `phoneticMap`.
- `options` (`SearchOptions`, optional): Toggles enabling linguistic matching features.
- `pagination` (`PaginationOptions`, optional): Search result paging bounds.
- `fuseIndex` (`Fuse<TVerse>`, optional): Pre-built Fuse index for performance.
- `cache` (`LRUCache`, optional): LRU cache for result caching.

**Returns:** `SearchResponse`

```typescript
import { search } from 'quran-search-engine';

const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap },
  { lemma: true, root: true },
  { page: 1, limit: 10 },
);
```
### `exportResults(response, format?)`

**Description:** Exports search results in JSON, CSV, or TSV format.

**Parameters:**

- `response` (`SearchResponse<QuranText>`): The search response containing the results to export.
- `format` (`ExportFormat`, optional): The output format. Supported values are `json`, `csv`, and `tsv`. Defaults to `json`.

**Returns:** `string`

```typescript
import { search, exportResults } from 'quran-search-engine';

const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap },
  { lemma: true, root: true },
);

// JSON export
const json = exportResults(response);

// CSV export
const csv = exportResults(response, 'csv');

// TSV export
const tsv = exportResults(response, 'tsv');
```

### Regex Search

#### `validateRegex(pattern)`

**Description:** Validates a user-supplied regex string for syntactic correctness and safety. Rejects patterns known to cause catastrophic backtracking (ReDoS). Useful for UI-side validation before calling `search()` with `{ isRegex: true }`, similar to how `isArabic()` and `removeTashkeel()` are used for input validation.

**Parameters:**

- `pattern` (string): The raw regex string from the user.

**Returns:** A compiled `RegExp` (with Unicode flag) ready for use against normalized Arabic text.

**Throws:** `InvalidRegexError` if the pattern is syntactically invalid or contains dangerous constructs.

```typescript
import { validateRegex } from 'quran-search-engine';

// UI validation before submitting the search
try {
  validateRegex(userInput); // valid pattern
  // Safe to call search() with { isRegex: true }
} catch (e) {
  // Show validation error to the user
}

validateRegex('^.*ون$'); // Returns compiled RegExp
validateRegex('(a+)+'); // Throws InvalidRegexError (nested quantifiers)
```

#### Using regex via `search()`

The main way to run regex search is through the `search()` function with `{ isRegex: true }`. This handles validation, filtering, and pagination automatically:

```typescript
import { search } from 'quran-search-engine';

const response = search('^.*ون$', quranData, morphologyMap, wordMap, {
  lemma: false,
  root: false,
  isRegex: true,
  suraId: 2, // optional: limit to Al-Baqarah
});
```

---

### Highlighting

#### `getHighlightRanges(text, matchedTokens, tokenTypes?)`

**Description:** Computes an array of non-overlapping highlight ranges over the original uthmani text. Pure function that avoids HTML rendering, placing control in the UI's hands.

**Returns:** `HighlightRange[]`

```typescript
import { getHighlightRanges } from 'quran-search-engine';

// verse is a ScoredQuranText object from the search results
const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
```
