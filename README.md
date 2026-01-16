# Using `quran-search-engine`

This pure TypeScript library provides advanced searching capabilities for Quranic text, including morphological matching (roots and lemmas) and fuzzy search.

## Installation

```bash
npm install quran-search-engine
# or
yarn add quran-search-engine
```

## Core Concepts

The engine is stateless. You provide the data (Quran text) and the query, and it returns results. This ensures maximum flexibility for any framework (React, Node.js, Vue, etc.).

## Public API

### 1. Data Loading

Before searching, you likely need the morphology data.

```typescript
import { loadMorphology, type WordMap, type MorphologyAya } from 'quran-search-engine';

// Optional: Load default data provided with the package
// Note: This is an async operation if we use dynamic imports to save bundle size
const morphologyData = await loadMorphology(); 
```

### 2. Normalization

Utilities to clean and normalize Arabic text (unifying Alefs, removing diacritics).

```typescript
import { normalizeArabic } from 'quran-search-engine';

const clean = normalizeArabic("بِسْمِ ٱللَّهِ"); // "بسم الله"
```

### 3. Search Functions

#### `simpleSearch`
Fast, filter-based search.

```typescript
import { simpleSearch, type QuranText } from 'quran-search-engine';

const results = simpleSearch(
  quranData, // Your array of QuranText
  "Al-Mulk", // Query
  "surah_name_en" // Field to key off
);
```

#### `advancedSearch` 
The main engine power. Combines exact match, fuzzy search (Fuse.js), and linguistic match (root/lemma).

```typescript
import { advancedSearch, type AdvancedSearchOptions } from 'quran-search-engine';

const options: AdvancedSearchOptions = {
    useMorphology: true,
    lemma: true,
    root: true,
    // fuseOptions: { ... } // Custom Fuse.js config
};

const results = advancedSearch(
    "books",           // Query
    quranData,         // Data source
    morphologyData,    // From loadMorphology()
    wordMap,           // From loadWordMap()
    options
);

// Returns ScoredQuranText[]
/*
[
  {
    ...QuranText,
    matchScore: 10,
    matchType: 'exact' | 'lemma' | 'root'
  }
]
*/
```

## Types

```typescript
export interface QuranText {
  gid: number;
  surah: number;
  aya: number;
  text: string;
  // ... other fields
}

export interface SearchResult extends QuranText {
  score: number;
  matchType: 'exact' | 'lemma' | 'root' | 'fuzzy';
  highlightedTokenIndices?: number[]; // Indices of matching words
}
```

## Framework Examples

### React

```tsx
import { advancedSearch } from 'quran-search-engine';

const SearchComponent = ({ query }) => {
  const results = useMemo(() => {
    return advancedSearch(query, data, morph, wordMap, { root: true });
  }, [query]);

  return <div>{results.map(r => <ResultRow key={r.gid} item={r} />)}</div>
}
```

### Node.js API

```typescript
import { advancedSearch } from 'quran-search-engine';
import fs from 'fs';

// Load data from disk (or DB)
const quranJson = JSON.parse(fs.readFileSync('./quran.json'));

app.get('/search', (req, res) => {
   const matches = advancedSearch(req.query.q, quranJson, ...);
   res.json(matches);
});
```
