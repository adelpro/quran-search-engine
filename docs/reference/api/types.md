# Types Reference

Complete type definitions for `quran-search-engine`.

## Core Data Types

### `VerseInput`

Base interface for verse data passed to search operations.

```typescript
type VerseInput = {
  /** Global verse ID */
  gid: number;
  /** Uthmani script text (with diacritics) */
  uthmani: string;
  /** Normalized/standardized Arabic text */
  standard: string;
  /** Verse number within the surah (optional) */
  aya_id?: number;
  /** Surah number 1-114 (optional) */
  sura_id?: number;
  /** Juz number (optional) */
  juz_id?: number;
  /** Arabic surah name (optional) */
  sura_name?: string;
  /** English surah name (optional) */
  sura_name_en?: string;
  /** Romanized surah name (optional) */
  sura_name_romanization?: string;
};
```

### `QuranText`

Full verse data returned by `loadQuranData()`. Extends `VerseInput` with required fields.

```typescript
type QuranText = {
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
```

### `MorphologyAya`

Morphology data for a single verse (lemmas and roots).

```typescript
type MorphologyAya = {
  gid: number;
  /** Array of lemma forms found in this verse */
  lemmas: string[];
  /** Array of root forms found in this verse */
  roots: string[];
};
```

### `WordMap`

Maps normalized tokens to their lemma and root forms.

```typescript
type WordMap = Map<
  string,           // normalized token
  {
    lemma?: string; // canonical lemma form
    root?: string;   // root form
  }
>;
```

### `Sura`

Metadata for a single Surah.

```typescript
interface Sura {
  /** Surah number (1-114) */
  id: number;
  /** Arabic name */
  sura_name: string;
  /** English name */
  sura_name_en: string;
  /** Romanized name */
  sura_name_romanization: string;
  /** Total number of verses */
  total_verses: number;
  /** Juz numbers this surah spans */
  juz_ids: number[];
  /** Starting page number */
  page_start: number;
  /** Ending page number */
  page_end?: number;
}
```

---

## Search Types

### `MatchType`

The type of match found for a search result.

```typescript
type MatchType =
  | 'exact'    // Direct text match
  | 'lemma'    // Match via lemma (derived form)
  | 'root'     // Match via root (linguistic root)
  | 'fuzzy'    // Approximate/fuzzy match
  | 'range'    // Range query match
  | 'semantic' // Semantic/concept match
  | 'regex'    // Regular expression match
  | 'none';    // No match
```

### `ScoredVerse<TVerse>`

A verse with search scoring information.

```typescript
type ScoredVerse<TVerse extends VerseInput = QuranText> = TVerse & {
  /** Relevance score (higher = more relevant) */
  matchScore: number;
  /** How the match was found */
  matchType: MatchType;
  /** Tokens that matched */
  matchedTokens: string[];
  /** Match type per token */
  tokenTypes?: Record<string, MatchType>;
};

type ScoredQuranText = ScoredVerse<QuranText>;
```

### `SearchCounts`

Breakdown of match counts by type.

```typescript
type SearchCounts = {
  simple: number;   // Exact matches
  lemma: number;    // Lemma matches
  root: number;     // Root matches
  fuzzy: number;    // Fuzzy matches
  range: number;    // Range matches
  semantic: number; // Semantic matches
  regex: number;     // Regex matches
  total: number;    // Total matches
};
```

### `SearchOptions`

Configuration options for the search function.

```typescript
type SearchOptions = {
  /** Enable lemma-based matching */
  lemma: boolean;
  /** Enable root-based matching */
  root: boolean;
  /** Enable fuzzy matching (optional, default: false) */
  fuzzy?: boolean;
  /** Treat query as regex pattern (optional) */
  isRegex?: boolean;
  /** Filter by surah number (optional) */
  suraId?: number;
  /** Filter by juz number (optional) */
  juzId?: number;
  /** Filter by Arabic surah name (optional) */
  suraName?: string;
  /** Filter by English surah name (optional) */
  sura_name_en?: string;
  /** Filter by romanized surah name (optional) */
  sura_name_romanization?: string;
  /** Enable semantic matching (optional) */
  semantic?: boolean;
};
```

### `PaginationOptions`

Pagination configuration.

```typescript
type PaginationOptions = {
  /** Page number (1-based) */
  page?: number;
  /** Results per page */
  limit?: number;
};
```

### `SearchResponse<TVerse>`

The complete search result object.

```typescript
type SearchResponse<TVerse extends VerseInput = QuranText> = {
  /** Array of scored and ranked verses */
  results: ScoredVerse<TVerse>[];
  /** Count breakdown by match type */
  counts: SearchCounts;
  /** Pagination metadata */
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};
```

### `ParsedRange`

Represents a parsed range query.

```typescript
type ParsedRange = {
  /** Sura number (1–114) */
  sura: number;
  /** Starting verse (undefined for entire surah) */
  startAya?: number;
  /** Ending verse (only for ranges like "1:1-7") */
  endAya?: number;
};
```

---

## Index Types

### `LemmaIndex`, `RootIndex`, `WordIndex`

Inverted index structures for fast lookups.

```typescript
type LemmaIndex = Map<string, Set<number>>;  // lemma → verse GIDs
type RootIndex  = Map<string, Set<number>>;  // root → verse GIDs
type WordIndex  = Map<string, Set<number>>;    // word → verse GIDs
```

### `InvertedIndex`

Container for all inverted indices.

```typescript
type InvertedIndex = {
  lemmaIndex: LemmaIndex;
  rootIndex: RootIndex;
  wordIndex: WordIndex;
  semanticIndex?: Map<string, Set<number>>;
  phoneticIndex?: Map<string, Set<number>>;
};
```

---

## Boolean Search Types

### `BooleanQuery`

Parsed boolean query structure.

```typescript
interface BooleanQuery {
  /** Terms prefixed with + (must all match) */
  must: string[];
  /** Terms prefixed with - (must not match) */
  exclude: string[];
  /** Bare terms or | groups (at least one must match) */
  either: string[];
}
```

---

## Validation Types

### `SchemaError`

A single validation error.

```typescript
type SchemaError = {
  /** Dot-path to the field, e.g. "verses[0].gid" */
  path: string;
  /** Human-readable error message */
  message: string;
};
```

### `ValidationResult`

Result of a validation operation.

```typescript
type ValidationResult = {
  valid: boolean;
  errors: SchemaError[];
};
```

---

## Error Types

### `ErrorShape`

Standard error structure.

```typescript
type ErrorShape = {
  message: string;
  code: string;
  type: string;
};
```

### Error Classes

| Class | Type | Description |
|-------|------|-------------|
| `BaseError` | Base | Abstract base error class |
| `DataLoadError` | Data | Base class for data loading errors |
| `DataFileNotFoundError` | Data | Data file not found |
| `DataParseError` | Data | Failed to parse data file |
| `DataSchemaInvalidError` | Data | Data doesn't match expected schema |
| `SearchError` | Search | Base class for search errors |
| `InvalidQueryError` | Search | Invalid search query |
| `MissingDependenciesError` | Search | Required data not loaded |
| `SearchOperationFailedError` | Search | Search operation failed |
| `InvalidRegexError` | Search | Invalid regex pattern |
| `ValidationError` | Validation | Validation failed |
| `InvalidPaginationError` | Validation | Invalid pagination parameters |
| `InvalidOptionsError` | Validation | Invalid search options |
| `TokenizationError` | Tokenization | Tokenization failed |
| `MissingMorphologyError` | Tokenization | Morphology data required |
| `InvalidModeError` | Tokenization | Invalid tokenization mode |

---

## Worker Types

### `WorkerRequest`

Request messages sent to the worker.

```typescript
type WorkerRequest =
  | InitDataRequest    // { type: 'INIT_DATA', requestId }
  | RunSearchRequest    // { type: 'RUN_SEARCH', requestId, query, options, pagination }
  | DisposeRequest;     // { type: 'DISPOSE' }
```

### `WorkerResponse<TVerse>`

Response messages received from the worker.

```typescript
type WorkerResponse<TVerse extends VerseInput = VerseInput> =
  | InitDataResponse       // { type: 'INIT_DATA_RESULT', requestId, success, error? }
  | SearchResultResponse   // { type: 'SEARCH_RESULT', requestId, data, timingMs }
  | ErrorResponse;          // { type: 'ERROR', requestId, error }
```

### `CreateSearchWorkerOptions`

Options for creating a search worker.

```typescript
type CreateSearchWorkerOptions = {
  /** URL to the worker script */
  workerScriptUrl?: string;
  /** Timeout for operations in ms */
  timeout?: number;
  /** Called when search completes */
  onResult?: (result: SearchResponse) => void;
  /** Called on errors */
  onError?: (error: Error) => void;
};
```

### `FallbackDependencies`

Dependencies for fallback mode when workers aren't supported.

```typescript
type FallbackDependencies = {
  quranData: QuranText[];
  morphologyMap: Map<number, MorphologyAya>;
  wordMap: WordMap;
};
```

### `SearchWorkerClient`

Interface for communicating with the search worker.

```typescript
interface SearchWorkerClient {
  initData(): Promise<void>;
  runSearch(
    query: string,
    options: AdvancedSearchOptions,
    pagination: PaginationOptions,
  ): Promise<SearchResponse>;
  terminate(): void;
}
```
