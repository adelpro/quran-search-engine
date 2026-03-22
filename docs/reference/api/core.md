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

| Function | Description |
|----------|-------------|
| `validateQuranData(data)` | Validates verse data against `VerseInput` schema |
| `validateMorphologyData(data)` | Validates morphology array structure |
| `validateWordMapData(data)` | Validates word map dictionary |
| `validateSemanticData(data)` | Validates semantic mapping data |

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
