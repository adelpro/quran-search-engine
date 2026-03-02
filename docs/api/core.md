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

### `search(query, quranData, morphologyMap, wordMap, options?, pagination?)`

**Description:** The main entry point for querying the engine. Combines Exact, Lemma, Root, and Fuzzy matching dynamically based on the provided tokens.

**Parameters:**

- `query` (string): The search query (can be multi-word).
- `quranData` (`QuranText[]` or `VerseInput[]`): The dataset array. Must contain `gid` and `standard` text fields (along with `uthmani` ideally).
- `morphologyMap` (`Map<number, MorphologyAya>`): Map of verse morphology data to allow root/lemma fallback.
- `wordMap` (`WordMap`): Root word dictionary.
- `options` (`SearchOptions`, optional): Toggles enabling linguistic matching features.
- `pagination` (`PaginationOptions`, optional): Search result paging bounds.

**Returns:** `SearchResponse`

```typescript
import { search } from 'quran-search-engine';

const response = search(
  'الله الرحمن',
  quranData,
  morphologyMap,
  wordMap,
  { lemma: true, root: true },
  { page: 1, limit: 10 },
);
```

### Highlighting

#### `getHighlightRanges(text, matchedTokens, tokenTypes?)`

**Description:** Computes an array of non-overlapping highlight ranges over the original uthmani text. Pure function that avoids HTML rendering, placing control in the UI's hands.

**Returns:** `HighlightRange[]`

```typescript
import { getHighlightRanges } from 'quran-search-engine';

// verse is a ScoredQuranText object from the search results
const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
```
