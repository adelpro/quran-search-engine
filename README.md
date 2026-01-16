# quran-search-engine

A stateless, pure TypeScript search engine for Quranic text with:

- Arabic normalization
- Exact text search
- Lemma + root matching (via morphology + word map)
- Highlight ranges (UI-agnostic)

## Installation

```bash
npm install quran-search-engine
yarn add quran-search-engine
pnpm add quran-search-engine
```

## Quickstart

```ts
import {
  search,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  type SearchResponse,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);
// Example output:
// quranData.length => 6236
// morphologyMap.size => 6236
// Object.keys(wordMap).length => (depends on dataset)

const response: SearchResponse = search('الله الرحمن', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,
});

response.results.forEach((v) => {
  console.log(v.sura_id, v.aya_id, v.matchType, v.matchScore);
});
// Example output:
// 1 1 exact 6
// 1 3 lemma 4
```

## Public API

Everything documented below is exported from `quran-search-engine` (aligned with `src/index.ts`).

### Data loading

#### `loadQuranData()`

Use case: load the Quran dataset once at app startup (browser or Node), then reuse in searches.

```ts
import { loadQuranData, type QuranText } from 'quran-search-engine';

const quranData: QuranText[] = await loadQuranData();
// Example output:
// quranData[0] => { gid: 1, uthmani: '...', standard: '...', sura_id: 1, aya_id: 1, ... }
```

#### `loadMorphology()`

Use case: enable lemma/root search and scoring.

```ts
import { loadMorphology, type MorphologyAya } from 'quran-search-engine';

const morphologyMap: Map<number, MorphologyAya> = await loadMorphology();
// Example output:
// morphologyMap.get(1) => { gid: 1, lemmas: ['...'], roots: ['...'] }
```

#### `loadWordMap()`

Use case: map normalized query tokens to their canonical lemma/root.

```ts
import { loadWordMap, type WordMap } from 'quran-search-engine';

const wordMap: WordMap = await loadWordMap();
// Example output:
// wordMap['الله'] => { lemma: 'الله', root: 'ا ل ه' }
```

### Normalization

#### `removeTashkeel(text)`

Use case: stripping diacritics (tashkeel) for display or simple comparisons.

```ts
import { removeTashkeel } from 'quran-search-engine';

const out = removeTashkeel('بِسْمِ ٱللَّهِ');
// out => 'بسم الله'
```

#### `normalizeArabic(text)`

Use case: preparing user input for searching (unifies alef variants, removes tashkeel, etc).

```ts
import { normalizeArabic } from 'quran-search-engine';

const out = normalizeArabic('بِسْمِ ٱللَّهِ');
// out => 'بسم الله'
```

### Search

#### `search(query, quranData, morphologyMap, wordMap, options?, pagination?)`

Main entry point. Combines:

- Exact text matching
- Lemma/root matching (when enabled and available)
- Fuzzy fallback (Fuse) per token

Use case: your primary API for Quran search results + scoring + pagination.

```ts
import { search } from 'quran-search-engine';

const response = search(
  'الله الرحمن',
  quranData,
  morphologyMap,
  wordMap,
  { lemma: true, root: true },
  { page: 1, limit: 10 },
);
// Example output:
// response.pagination => { totalResults: 42, totalPages: 5, currentPage: 1, limit: 10 }
// response.counts => { simple: 10, lemma: 18, root: 9, fuzzy: 5, total: 42 }
// response.results[0] => { gid: 123, matchType: 'exact', matchScore: 9, matchedTokens: ['...'], ... }
```

If you need a simple “contains all tokens in a field” filter for your own data, you can do:

```ts
import { normalizeArabic } from 'quran-search-engine';

export function containsAllTokens(value: string, query: string): boolean {
  const q = normalizeArabic(query);
  if (!q) return false;

  const tokens = q.split(/\s+/);
  const v = normalizeArabic(value);
  return tokens.every((t) => v.includes(t));
}
```

### Highlighting (UI-agnostic)

#### `getHighlightRanges(text, matchedTokens, tokenTypes?)`

Computes non-overlapping highlight ranges. This is pure (no HTML output), so the consumer controls rendering.

Use case: highlight matches in UI without `dangerouslySetInnerHTML`.

```ts
import { getHighlightRanges } from 'quran-search-engine';

const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
// Example output (shape):
// [
//   { start: 12, end: 23, token: 'الله', matchType: 'exact' },
//   { start: 30, end: 45, token: 'الرحمن', matchType: 'lemma' },
// ]
```

React rendering example:

```tsx
import { getHighlightRanges, type ScoredQuranText } from 'quran-search-engine';
import type { ReactNode } from 'react';

export function Verse({ verse }: { verse: ScoredQuranText }) {
  const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
  if (ranges.length === 0) return <span>{verse.uthmani}</span>;

  const parts: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((r, i) => {
    if (cursor < r.start) parts.push(verse.uthmani.slice(cursor, r.start));
    parts.push(
      <span key={`${r.start}-${r.end}-${i}`} className={`highlight highlight-${r.matchType}`}>
        {verse.uthmani.slice(r.start, r.end)}
      </span>,
    );
    cursor = r.end;
  });

  if (cursor < verse.uthmani.length) parts.push(verse.uthmani.slice(cursor));

  return <span>{parts}</span>;
}
```

## How scoring works

`search` returns `ScoredQuranText` results with `matchScore`, `matchType`, `matchedTokens`, and `tokenTypes`.

- The query is cleaned to Arabic letters/spaces, then normalized, then split by whitespace into tokens.
- For each query token, scoring accumulates across match layers:
  - Exact word matches in the verse: `+3` per matched word
  - Lemma matches (when enabled): `+2` per matched word
  - Root matches (when enabled): `+1` per matched word
  - Fuzzy matches: only used as a fallback when the verse has no exact/lemma/root matches; `+0.5` per fuzzy segment extracted from Fuse indices
- `matchedTokens` is deduplicated (used for highlighting).
- `matchType` is the best “overall” type seen on that verse (`exact` > `lemma` > `root` > `fuzzy`/`none`).

## Multi-word search

`search` supports multi-word queries.

- Query tokenization: the normalized query is split by whitespace.
- AND logic:
  - `search` intersects matches per token, so results must match every token (via exact, lemma/root, or fuzzy fallback for that token).

Example:

```ts
const response = search('الله الرحمن', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,
});
// Example output:
// response.results => all returned verses match BOTH tokens (AND logic)
```

## Core types

These are the main types you’ll interact with when calling `search(...)` and rendering results.

```ts
import type {
  HighlightRange,
  MatchType,
  MorphologyAya,
  PaginationOptions,
  QuranText,
  ScoredQuranText,
  SearchOptions,
  SearchCounts,
  SearchResponse,
  WordMap,
} from 'quran-search-engine';
```

### `QuranText`

One verse record in the dataset (input to `search`).

```ts
export type QuranText = {
  gid: number;
  uthmani: string;
  standard: string;
  sura_id: number;
  aya_id: number;
  aya_id_display: string;
  page_id: number;
  juz_id: number;
  sura_name: string;
  sura_name_en: string;
  sura_name_romanization: string;
  standard_full: string;
};
```

### `MorphologyAya`

Morphology info for one verse (looked up by `gid` via a `Map<number, MorphologyAya>`).

```ts
export type MorphologyAya = {
  gid: number;
  lemmas: string[];
  roots: string[];
};
```

### `WordMap`

Dictionary mapping a normalized token to lemma/root. Used to resolve query tokens into canonical forms for lemma/root matching.

```ts
export type WordMap = {
  [normalizedToken: string]: {
    lemma?: string;
    root?: string;
  };
};
```

### `SearchOptions`

Toggles for linguistic matching:

```ts
export type SearchOptions = {
  lemma: boolean;
  root: boolean;
};
```

### `PaginationOptions`

Controls paging (defaults are applied if omitted):

```ts
export type PaginationOptions = {
  page?: number;
  limit?: number;
};
```

### `MatchType`

Overall “best” match class for a verse:

```ts
export type MatchType = 'exact' | 'lemma' | 'root' | 'fuzzy' | 'none';
```

### `ScoredQuranText`

The verse returned by `search`, including scoring and highlighting metadata:

```ts
export type ScoredQuranText = QuranText & {
  matchScore: number;
  matchType: MatchType;
  matchedTokens: string[];
  tokenTypes?: Record<string, MatchType>;
};
```

### `SearchResponse`

Full response from `search`:

```ts
export type SearchResponse = {
  results: ScoredQuranText[];
  counts: SearchCounts;
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};
```

### `HighlightRange`

Range output from `getHighlightRanges(...)`:

```ts
export type HighlightRange = {
  start: number;
  end: number;
  token: string;
  matchType: MatchType;
};
```

## Example app

A Vite + React demo exists in `example/`.

```bash
pnpm -C example install
pnpm -C example dev
```

## Development

```bash
pnpm run lint
pnpm run test
pnpm run build
```

## Contributing

- Open an issue to discuss larger changes before starting implementation.
- Keep changes focused and include tests when applicable.
- Ensure checks pass locally: `pnpm run lint && pnpm run test && pnpm run build`.

## Contact

- Adel Benyahia — <contact@adelpro.us.kg>

## License

MIT
