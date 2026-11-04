<!-- markdownlint-disable-next-line MD041 -->
<p align="center">
  <img src="./assets/800x450.png" width="850" height="400" alt="quran-search-engine logo" />
</p>

# quran-search-engine

[![npm](https://img.shields.io/npm/v/quran-search-engine)](https://www.npmjs.com/package/quran-search-engine)
[![downloads](https://img.shields.io/npm/dm/quran-search-engine)](https://www.npmjs.com/package/quran-search-engine)
![TypeScript](https://img.shields.io/badge/ts-yes-blue)
[![Changelog](https://img.shields.io/badge/changelog-view-brightgreen)](https://github.com/adelpro/quran-search-engine/releases)
![license](https://img.shields.io/npm/l/quran-search-engine)
[![bundle limit](https://img.shields.io/badge/bundle%20limit-2%20MB-blue)](https://github.com/adelpro/quran-search-engine/blob/main/package.json#L80)
[![Athar](https://img.shields.io/static/v1?label=Athar&message=%F0%9F%8C%99&color=blue)](https://community.itqan.dev/d/254/15)
[![Live Demo](https://img.shields.io/badge/demo-live-blue)](https://quran.us.kg/search)
[![Docs](https://img.shields.io/badge/docs-view-blue)](https://adelpro.us.kg/quran-search-engine/)

Stateless, UI-agnostic Quran (Qur'an) search engine for Arabic text in pure TypeScript:

- **Boolean Search**: `+term` (must), `-term` (must not), and `term | term` (either), auto-detected from the query
- Arabic normalization
- Exact text search
- Lemma + root matching (via morphology + word map)
- Inverted index for O(1) lemma/root lookups (`buildInvertedIndex`)
- Semantic search (concept-based mapping)
- **Subject-based thematic search** — map English concept words (e.g. `"climate"`,
  `"worship"`) to curated Arabic lemmas via `loadSubjectData()`
- **Independent multi-term search** — pass an array of terms and merge/rank by score, coverage, or frequency
- **CLI** — `npx quran-search-engine "..."` for terminal and scripted use
- Phonetic search with fuzzy fallback (e.g. "Bismillah" -> "بسم الله")
- Regex search with ReDoS safety validation (`validateRegex` for UI-side input checking)
- Range search by sura/aya coordinates (e.g. `2:255`, `1:1-7`, `2:`)
- Highlight ranges (UI-agnostic)
- Built-in LRU cache for repeated queries

## Table of contents

- [Why this library](#why-this-library)
- [Installation](#installation)
- [Development Setup](#development-setup)
- [Quickstart](#quickstart)
- [CLI](#cli)
- [Public API](#public-api)
- [Error Handling](#error-handling)
- [How scoring works](#how-scoring-works)
- [Multi-word search](#multi-word-search)
- [Caching with LRUCache](#caching-with-lrucache)
- [Performance Optimization](#performance-optimization-advanced)
- [Core types](#core-types)
- [Non-goals](#non-goals)
- [Example apps](#example-apps)
- [Testing](#testing)
- [Development](#development)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Why this library

Most Quran search solutions are:

- tightly coupled to a UI
- server-bound or stateful
- hard to customize or extend
- weakly typed

**quran-search-engine** is designed to be:

- UI-agnostic (React, Vue, React Native, Node)
- fully client-side or server-side
- stateless and deterministic
- TypeScript-first and strongly typed

You control the data, rendering, and persistence.

## Installation

This project uses **yarn** as the default package manager.

```bash
yarn add quran-search-engine
```

<details> <summary>Other package managers</summary>
<br>
npm install quran-search-engine <br>
pnpm add quran-search-engine <br>

</details>

## Development Setup

This is a **yarn workspace** monorepo containing the main library and example applications. The workspace is configured
in `package.json` to include:

- The main library (root package)
- All examples in the `examples/` directory

### Prerequisites

Install yarn if you haven't already:

```bash
npm install -g yarn
# or
corepack enable yarn
```

### Setup Commands

```bash
# Install all dependencies for the workspace and examples
yarn install

# Build the main library
yarn build

# Run tests across the workspace
yarn test
```

## Quickstart

> Note: examples assume an async context (Node 18+, ESM, or browser).

```ts
import {
  search,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  loadSemanticData,
  buildInvertedIndex,
  type SearchResponse,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap, semanticMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
]);

const invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap);

const response: SearchResponse = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap, semanticMap, invertedIndex },
  {
    lemma: true,
    root: true,
    semantic: true,
  },
);

response.results.forEach((v) => {
  console.log(v.sura_id, v.aya_id, v.matchType, v.matchScore);
});
```

With caching (recommended for apps with repeated searches):

```ts
import { search, LRUCache, loadQuranData, loadMorphology, loadWordMap } from 'quran-search-engine';
import type { SearchResponse, QuranText } from 'quran-search-engine';

const [quranData, morphologyMap, wordMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);

const context = { quranData, morphologyMap, wordMap };

// Create a cache that holds the last 50 search results
const cache = new LRUCache<string, SearchResponse<QuranText>>(50);

// First call: computes and caches the result
const result1 = search(
  'الله',
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20 },
  undefined,
  cache,
);

// Second call with same params: returns cached result instantly (same reference)
const result2 = search(
  'الله',
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20 },
  undefined,
  cache,
);

console.log(result1 === result2); // true — cache hit
```

JavaScript (Node / ESM):

```js
import {
  search,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  buildInvertedIndex,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);

const invertedIndex = buildInvertedIndex(morphologyMap, quranData);

const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap, invertedIndex },
  {
    lemma: true,
    root: true,
  },
);

console.log(response.results[0]);
```

> [!IMPORTANT]
> **Note for Developers**: This project uses a yarn workspace with `workspace:*` links. If you make changes to the
> library's source code in `src/`, you **must build the library** using `yarn build` (or run it in watch mode with
> `yarn build --watch`) for those changes to be reflected in the example applications.

## CLI

The package publishes a `quran-search-engine` command, so the engine can be queried from a
terminal or a shell script without writing any code.

```bash
npx quran-search-engine "رحم"                    # no install needed
yarn global add quran-search-engine              # or install it globally
```

```bash
quran-search-engine "رحمة" --format json | jq .  # pipe into another tool
quran-search-engine "الله" --sura 1 --limit 5    # narrow and page
quran-search-engine "2:255"                      # verse coordinates, no flag needed
quran-search-engine --help                       # every option, with its default
```

Exit codes are `0` when it completed, including when nothing matched, `1` for a runtime error
and `2` for invalid usage, so scripts can tell those apart without reading the message.

See the [CLI guide](./docs/guides/cli.md) for the full option list, the output formats, the query
shapes that need no flag, and how to run it from a source checkout.

## Public API

Everything documented below is exported from `quran-search-engine` (aligned with `src/index.ts`).

### Data loading

> Note: The bundled lemma (morphology) data and word map were downloaded from Quranic Arabic Corpus v4.0: <https://corpus.quran.com>

#### `loadQuranData()`

Use case: load the Quran dataset once at app startup (browser or Node), then reuse in searches.

```ts
import { loadQuranData, type QuranText } from 'quran-search-engine';

const quranData: Map<number, QuranText> = await loadQuranData();
// Example output:
// quranData.get(1) => { gid: 1, uthmani: '...', standard: '...', sura_id: 1, aya_id: 1, ... }
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

#### `loadSubjectData()`

Use case: enable subject-based thematic search by loading the curated Arabic lemma map grouped by Islamic theme.

```ts
import { loadSubjectData } from 'quran-search-engine';

const subjectMap = await loadSubjectData();
// subjectMap.get('climate') => ['مطر', 'رياح', 'عاصفة', 'سحاب', ...]
// subjectMap.get('worship') => ['عبادة', 'صلاة', 'ذكر', ...]
```

Pass `subjectMap` to `buildInvertedIndex` and to the `search` context, then set `{ subject: true }` in options:

```ts
import { loadSubjectData, buildInvertedIndex, search } from 'quran-search-engine';

const subjectMap = await loadSubjectData();
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

const response = search(
  'climate',
  { quranData, morphologyMap, wordMap, invertedIndex, subjectMap },
  { subject: true },
);
// → returns verses about مطر، رياح، عاصفة، سحاب...
```

**How a subject word matches.** A word matches a verse when it shares the verse's root, is one
of the verse's lemmas, or appears as a whole token once Arabic clitics are attached (`الرياح`
for `رياح`). Root resolution is what lets the bare `مطر` also reach `وأمطرنا`, and it needs
`wordMap` — pass it to `buildInvertedIndex` as shown above, otherwise subjects fall back to lemma
and clitic matching only.

Substring containment is deliberately _not_ a match: it would pull `سماء` into every `ماء`
search and `كتاب` into every `اب` search.

**Write subject words in their base form.** `مطر` covers `أمطار`, `وأمطرنا` and `مطرًا`
through the shared root, so listing the plural as well adds nothing — and `أمطار` does not occur
in the Quran at all.

> **Note:** `src/data/subjects.json` is a seed dataset. It covers 20 themes with a handful of
> English synonyms and Arabic words each — enough to demonstrate thematic search, not enough to
> cover the Quran's themes. Contributions that add themes, synonyms, or Arabic words are welcome.

#### `buildInvertedIndex(morphologyMap, quranData, semanticMap?, subjectMap?, wordMap?)`

Builds in-memory inverted indices from the morphology map and verse data in a single pass.
Produces indices for lemma, root, word, semantic concepts, and (optionally) subject themes.

- `lemmaIndex`: lemma → Set of verse GIDs
- `rootIndex`: root → Set of verse GIDs
- `wordIndex`: normalized word → Set of verse GIDs
- `semanticIndex`: semantic concept → Set of verse GIDs (when `semanticMap` is provided)
- `subjectIndex`: subject key → Set of verse GIDs (when `subjectMap` is provided)

`wordMap` is optional and is used to resolve each subject word through its root — both while
building `subjectIndex` and during subject search — so `مطر` also covers `وأمطرنا`. Omit it and
subject words resolve by lemma and clitic form only.

This converts lemma/root lookups during search from **O(n)** linear scans to **O(1)** Map lookups.

Use case: build the index once at startup and pass it to every `search()` call for maximum throughput.

```ts
import {
  buildInvertedIndex,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  loadSemanticData,
  loadSubjectData,
  search,
  type InvertedIndex,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap, semanticMap, subjectMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
  loadSubjectData(), // v0.4.0+
]);

// Build once — O(n) one-time cost
const invertedIndex: InvertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

// Pass to every search call via context — O(1) lookups
const result = search(
  'الرحمن',
  { quranData, morphologyMap, wordMap, invertedIndex, semanticMap, subjectMap },
  { lemma: true, root: true },
  { page: 1, limit: 20 },
);
```

#### Pre-built inverted index?

There is no bundled pre-built index in v0.4.0, so there is no `loadInvertedIndex()` to call.
Build it once from the datasets and reuse the result:

```ts
import { buildInvertedIndex } from 'quran-search-engine';

const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);
```

The build is a single CPU pass (typically well under a second) and replaces the linear scans
used on every lemma/root lookup.

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

const normalized = normalizeArabic('ٱلرَّحْمَٰن');
// normalized => 'الرحمن'
```

#### `search(query, context, options?, pagination?, fuseIndex?, cache?)`

Main entry point. Combines:

- Exact text matching
- Lemma/root matching (when enabled and available)
- Fuzzy fallback (Fuse) per token
- Semantic concept expansion (when `options.semantic = true`)
- Subject/theme expansion (when `options.subject = true`)
- Range lookups (`2:255`, `1:1-7`, `2:`)
- Regex pattern matching (when `options.isRegex = true`)

Use case: your primary API for Quran search results + scoring + pagination.

| Argument     | Type                    | Description                                                                            |
| ------------ | ----------------------- | -------------------------------------------------------------------------------------- |
| `query`      | `string \| string[]`    | One query string, or an array of independent terms                                     |
| `context`    | `SearchContext`         | Object containing `quranData`, `morphologyMap`, `wordMap`, etc.                        |
| `options`    | `AdvancedSearchOptions` | Toggles for lemma/root/fuzzy/semantic/subject (default: `{ lemma: true, root: true }`) |
| `pagination` | `PaginationOptions`     | Page and limit (default: `{ page: 1, limit: 20 }`); arrays also accept `rankBy`        |
| `fuseIndex`  | `Fuse<TVerse>`          | Pre-built Fuse index — skips rebuild on every call                                     |
| `cache`      | `LRUCache`              | LRU cache — returns cached result for identical calls                                  |

Passing an array returns a `MultiTermResponse`; passing a string returns `SearchResponse`.

**Optimization**: Include a `fuseIndex` (from `createArabicFuseSearch`) or an `invertedIndex`
within the `context` to skip recalculations. Pass an `LRUCache` instance to cache results.

```ts
import { search } from 'quran-search-engine';

const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap, semanticMap },
  { lemma: true, root: true, semantic: true }, // options
  { page: 1, limit: 10 }, // pagination
);
// Example output:
// response.pagination => { totalResults: 42, totalPages: 5, currentPage: 1, limit: 10 }
// response.counts => { simple: 10, lemma: 18, root: 9, fuzzy: 5, semantic: 0, subject: 0, regex: 0, range: 0, total: 42 }
// response.results[0] => { gid: 123, matchType: 'exact', matchScore: 9, matchedTokens: ['...'], ... }
```

| Match type | Score per hit               |
| ---------- | --------------------------- |
| Exact      | +3                          |
| Lemma      | +2                          |
| Root       | +1                          |
| Fuzzy      | +0.5 (fallback only)        |
| Semantic   | +5 per matched keyword      |
| Subject    | +4 per matched subject word |
| Range      | 1 (direct lookup)           |
| Regex      | 1                           |

The search engine processes queries through a series of architectural layers, each handling a specific type of search
logic. This layered approach allows for efficient short-circuiting and specialized processing:

1. **Range layer** — Verse-coordinate queries (`2:255`, `1:1-7`) short-circuit all linguistic processing.
2. **Boolean filter** — Queries containing `+`, `-`, or `|` are parsed and used to filter the combined results.
3. **Regex layer** — Pattern queries (when `isRegex: true`) run in isolation; linguistic layers are skipped.
4. **Simple layer** — Exact token matching in normalized Arabic text.
5. **Linguistic layer** — Lemma and root matching via morphology data.
6. **Fuse layer** — Fuzzy fallback (Fuse.js) for tokens that produced no matches above.
7. **Semantic layer** — Concept expansion (when `semantic: true`).
8. **Subject layer** — Thematic expansion (when `subject: true`).
9. **Phonetic layer** — Latin→Arabic transliteration for non-Arabic queries.
10. **Multi-term merge** — `search(string[])` runs every term independently and merges by `gid`.

#### Regex Search

`search` supports regex queries when `{ isRegex: true }` is passed. The query string is compiled as a Unicode-aware
`RegExp` and matched against each verse's normalized `standard` text. The engine validates patterns for correctness and
rejects unsafe patterns known to cause catastrophic backtracking (ReDoS).

Regex search bypasses all linguistic pipelines (lemma, root, fuzzy) and can be combined with `suraId`, `juzId`, or
`suraName` to narrow the search scope.

```ts
import { search } from 'quran-search-engine';

// Find verses ending with "ون"
const response = search(
  '^.*ون$',
  { quranData, morphologyMap, wordMap },
  {
    lemma: false,
    root: false,
    isRegex: true,
  },
);

// Combine with sura filtering
const filtered = search(
  'الله.*الرحمن',
  { quranData, morphologyMap, wordMap },
  {
    lemma: false,
    root: false,
    isRegex: true,
    suraId: 1, // only search in Al-Fatihah
  },
);
```

#### Boolean Search

Boolean operators are detected automatically — no option is required. The syntax uses
symbols, not words:

- `+term` (**MUST**) — the term must appear.
- `-term` (**EXCLUDE**) — the term must not appear.
- `term | term` (**EITHER/OR**) — at least one term must appear. Bare terms are also treated as
  `EITHER` terms.

```ts
import { search } from 'quran-search-engine';

// Verses containing الله but not الرحمن, and either الرحيم or العليم
const response = search(
  '+الله -الرحمن الرحيم | العليم',
  { quranData, morphologyMap, wordMap },
  { lemma: true, root: true },
);
```

Verified against the bundled dataset with `{ lemma: true, root: true, fuzzy: false }`:

| Query             | Meaning                   | Linear scan | With `invertedIndex` |
| ----------------- | ------------------------- | ----------- | -------------------- |
| `+الله -الرحمن`   | MUST الله, EXCLUDE الرحمن | 1741        | 1571                 |
| `الله \| الرحمن`  | الله OR الرحمن            | 1789        | 1616                 |
| `الله AND الرحمن` | not boolean — AND→عند     | 5           | 5                    |
| `الله NOT الرحمن` | not boolean — NOT dropped | 130         | 124                  |

> The words `AND`, `OR`, and `NOT` are not operators. `OR` and `NOT` are dropped as unknown
> non-Arabic tokens, so `'الله NOT الرحمن'` behaves like `'الله الرحمن'` — an intersection of
> the two Arabic words (124 with the index, 130 on a linear scan). `AND` is present in the
> phonetic map and resolves to `عند`, so `'الله AND الرحمن'` searches three Arabic words and
> returns 5. Use the symbol operators (`+`, `-`, `|`) for boolean logic.

**Index note:** the `invertedIndex` path matches exact normalized tokens, while the linear-scan
fallback uses substring matching, so clitic forms such as `بالله` are found only without an
index. Result counts therefore differ between the two paths; use one path consistently.

#### Range search

`search` supports coordinate-only range queries and range-scoped text queries.

| Query             | Result                                                   |
| ----------------- | -------------------------------------------------------- |
| `2:255`           | Single verse (Al-Baqarah, verse 255)                     |
| `1:1-7`           | Verse range (Al-Fatihah, verses 1 through 7)             |
| `2:`              | Entire sura (all verses of Al-Baqarah)                   |
| `1:1-4 العالمين`  | Search for `العالمين` only inside Al-Fatihah 1–4 (`1:2`) |
| `2:255-260 +الله` | Boolean search constrained to Al-Baqarah 255–260         |

Range queries require verses to have `sura_id` and `aya_id` fields (present in the bundled dataset). Bounds are 1-based
and inclusive; whitespace around `:` / `-` and leading zeros are accepted (`02:255` works). Aya numbers are not validated
against the real length of the sura, so `2:300` parses but returns 0, while `1:1-300` returns the seven verses that exist.
Malformed forms such as `0:1`, `115:1`, or `2:5-3` do not throw — they fall through to the standard linguistic search and
normally return no results.

A coordinate-only range returns dataset order with `matchType: 'range'`, `matchScore: 1`, and `counts.range` equal to the
total. Spatial filters intersect the range instead of being ignored, so `search('2:255', ctx, { suraId: 1 })` returns 0.
When several filters are supplied, only the highest-priority one runs: `suraId` > `suraName` > `juzId`. A contradictory
combination returns 0 and never throws. Adding text after the range (separated by whitespace) instead runs the normal
pipeline **only over the verses in that range**, so lemma/root/fuzzy/phonetic/semantic/subject/regex all stay scoped.
Those results carry their real `matchType` (for example `exact`) and `counts.range` is `0`; spatial filters apply on top
of the range in the same way.

The filter options are applied **to the matches** returned by the search layers. `suraName` scopes a query to a sura; it
does not enumerate every verse in that sura. For example, `search('الله', { suraName: 'Al-Fatihah' })` returns only the
Al-Fatihah verses that matched the word (two with lemma/root enabled), not all seven verses. Use a coordinate-only range
query such as `1:` when you want the whole sura.

```ts
import { search } from 'quran-search-engine';

// Single verse
const verse = search('2:255', { quranData, morphologyMap, wordMap });

// Verse range
const range = search('1:1-7', { quranData, morphologyMap, wordMap });

// Entire sura
const sura = search('1:', { quranData, morphologyMap, wordMap });

// Text search constrained to a range
const scoped = search('1:1-4 العالمين', { quranData, morphologyMap, wordMap });
```

#### Semantic Search

`search` supports semantic (concept-based) queries. It uses a pre-built semantic map to link words to their synonyms and
related concepts.

- **Arabic Synonyms**: Searching for "إنسان" (human) will also find verses containing "بشر", "ناس", "بني آدم", etc.
- **English Concepts**: Searching for "Paradise" will find verses containing "جنة", "فردوس", "عدن", etc. (Note: Ensure
  the query cleaning logic allows English characters if you enable this).

```ts
const response = search(
  'Paradise',
  { quranData, morphologyMap, wordMap, semanticMap },
  {
    semantic: true,
  },
);
// response.results => verses containing words related to Paradise
```

#### Phonetic Search

`search` supports phonetic (Latin) queries. Using a pre-built phonetic map, the engine detects non-Arabic input and
translates it to the corresponding Arabic representation.

- **Exact Phonetic Match**: Searching for "Bismillah" will correctly find verses containing "بسم الله".
- **Fuzzy Phonetic Fallback**: The engine handles common transliteration typos (e.g., "bismii" instead of "bismi") using
  a strict fuzzy matching fallback (Fuse.js).

```ts
const response = search('Bismillah', { quranData, morphologyMap, wordMap, phoneticMap });
// response.results[0] => gid: 1 (Basmalah)
```

If you need a simple “contains all tokens in a field” filter for your own data, you can do:

```ts
import { normalizeArabic } from 'quran-search-engine';

export function containsAllTokens(value: string, query: string): boolean {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return false;

  const tokens = normalizedQuery.split(/\s+/);
  const normalizedValue = normalizeArabic(value);
  return tokens.every((token) => normalizedValue.includes(token));
}
```

#### `createArabicFuseSearch(data, keys, options?)`

Use case: pre-compute the Fuse.js index for performance (see [Performance Optimization](#performance-optimization-advanced)).

```ts
import { createArabicFuseSearch } from 'quran-search-engine';

const fuseIndex = createArabicFuseSearch(Array.from(quranData.values()), ['standard', 'uthmani']);
```

#### Custom datasets

`search` accepts any dataset shape as long as each record satisfies `VerseInput`:

```ts
export type VerseInput = {
  gid: number;
  uthmani: string;
  standard: string;
  sura_id?: number;
  juz_id?: number;
  sura_name?: string;
  sura_name_en?: string;
  sura_name_romanization?: string;
  aya_id?: number;
};
```

Minimum requirements:

- Pass `quranData` as a `Map<number, VerseInput>` keyed by `gid` — `search` rejects arrays and empty maps
- `gid`: unique verse id (used to join with `morphologyMap`)
- `standard`: used for exact text matching
- `uthmani`: used for fuzzy fallback and commonly used for highlighting in UI (if you don’t have it, set it to `standard`)

Custom dataset example:

```ts
import { search, type VerseInput, type WordMap, type MorphologyAya } from 'quran-search-engine';

type MyVerse = VerseInput & {
  sura: number;
  aya: number;
  translation_en?: string;
};

const myQuranData = new Map<number, MyVerse>([
  [
    1,
    {
      gid: 1,
      standard: 'بسم الله الرحمن الرحيم',
      uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      sura: 1,
      aya: 1,
      translation_en: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
    },
  ],
]);

const morphologyMap = new Map<number, MorphologyAya>();
const wordMap: WordMap = new Map();

const response = search(
  'الله الرحمن',
  { quranData: myQuranData, morphologyMap, wordMap },
  {
    lemma: false,
    root: false,
  },
);
// Example output:
// response.results[0] => { gid: 1, sura: 1, aya: 1, matchType: 'exact', matchScore: 6, ... }
```

Validate custom files before loading them. The validators take the **raw JSON shapes** (arrays and plain objects),
not the `Map` instances returned by the loaders:

```ts
import {
  validateQuranData,
  validateMorphologyData,
  validateWordMapData,
  formatSchemaErrors,
} from 'quran-search-engine';

const check = validateQuranData(rawQuranArray);
if (!check.valid) {
  throw new Error(formatSchemaErrors(check));
}

// These expect raw JSON too:
validateMorphologyData(rawMorphologyArray); // [{ gid, lemmas, roots }]
validateWordMapData(rawWordMapObject); // { token: { lemma?, root? } }
```

`validateQuranData(new Map(...))` returns `valid: false` by design — pass the JSON you read from disk.

For lemma/root matching, provide both:

- `morphologyMap: Map<number, MorphologyAya>` where `MorphologyAya` is `{ gid, lemmas: string[], roots: string[] }`
- `wordMap: WordMap` — a `Map<string, { lemma?: string; root?: string }>`, not a plain object; each key is a
  normalized token

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

## Error Handling

The library provides a comprehensive error handling system with **10 specialized error classes** organized into 4
categories. All errors include structured error codes, types, and actionable messages with context.

### Error Categories

- **DataLoadError** - File loading and schema validation errors
- **SearchError** - Query and search operation errors
- **ValidationError** - Input validation errors
- **TokenizationError** - Text processing errors

### Basic Usage

```ts
import {
  loadMorphology,
  search,
  DataFileNotFoundError,
  DataParseError,
  InvalidPaginationError,
  MissingDependenciesError,
  ErrorCode,
} from 'quran-search-engine';

// Data loading errors
try {
  const morphology = await loadMorphology();
} catch (error) {
  if (error instanceof DataFileNotFoundError) {
    console.error('Missing file:', error.filePath);
    // Use fallback data
  } else if (error instanceof DataParseError) {
    console.error('Corrupted file:', error.filePath);
    // Re-download data
  }
}

// Search validation errors
try {
  const results = search(query, { quranData, morphologyMap, wordMap }, options, {
    page: 1,
    limit: 10,
  });
} catch (error) {
  if (error instanceof InvalidPaginationError) {
    console.error('Invalid pagination:', error.message);
  } else if (error instanceof MissingDependenciesError) {
    console.error('Missing data:', error.missingDependencies);
  }
}
```

### Error Codes

All errors include type-safe error codes:

```ts
import { search, ErrorCode } from 'quran-search-engine';

try {
  const results = search(query, { quranData, morphologyMap, wordMap });
} catch (error) {
  if (error.code === ErrorCode.DATA_FILE_NOT_FOUND) {
    // Handle missing file
  } else if (error.code === ErrorCode.VALIDATION_INVALID_PAGINATION) {
    // Handle invalid pagination
  } else if (error.code === ErrorCode.TOKENIZATION_INVALID_MODE) {
    // Handle invalid tokenization mode
  }
}
```

### Available Error Classes

**Data Loading Errors:**

- `DataFileNotFoundError` - Missing data files (includes `filePath`)
- `DataParseError` - JSON parsing failures (includes `filePath`, `cause`)
- `DataSchemaInvalidError` - Invalid data structure (includes `filePath`, `details`)

**Search Errors:**

- `InvalidQueryError` - Invalid search queries (includes `query`)
- `MissingDependenciesError` - Missing required dependencies (includes `missingDependencies` array)
- `SearchOperationFailedError` - Search operation failures (includes `operation`, `cause`)

**Validation Errors:**

- `InvalidPaginationError` - Invalid pagination parameters (includes `page`, `limit`)
- `InvalidOptionsError` - Invalid search options (includes `reason`)

**Tokenization Errors:**

- `MissingMorphologyError` - Missing morphology data (includes `gid`)
- `InvalidModeError` - Invalid tokenization mode (includes `mode`)

### Documentation

For complete error handling documentation, architecture details, and best practices, see [Error Handling Documentation](./src/errors/README.md).

## How scoring works

`search` returns `ScoredQuranText` results with `matchScore`, `matchType`, `matchedTokens`, and `tokenTypes`.

- The query is cleaned to Arabic letters/spaces, then normalized, then split by whitespace into tokens.
- For each query token, scoring accumulates across match layers:
  - Exact word matches in the verse: `+3` per matched word
  - Lemma matches (when enabled): `+2` per matched word
  - Root matches (when enabled): `+1` per matched word
  - Fuzzy matches: only used as a fallback when the verse has no exact/lemma/root matches; `+0.5` per fuzzy segment
    extracted from Fuse indices
- `matchedTokens` is deduplicated (used for highlighting).
- `matchType` is the best “overall” type seen on that verse (`exact` > `lemma` > `root` > `fuzzy`/`none`).

## Multi-word search

`search` supports multi-word queries.

- Query tokenization: the normalized query is split by whitespace.
- AND logic:
  - `search` intersects matches per token, so results must match every token (via exact, lemma/root, or fuzzy fallback
    for that token).

Example:

```ts
const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap },
  {
    lemma: true,
    root: true,
  },
);
// Example output:
// response.results => all returned verses match BOTH tokens (AND logic)
```

For independent multi-term search — where each term is searched separately and results are merged
and ranked — pass an array of strings instead. See the
[Subject & Multi-Word Search guide](docs/guides/subjects-and-multiword.md) for full examples,
including feeding an LLM's expanded keyword list straight into `search()`, the `rankBy` ranking
modes, and combining multi-word search with subject-based thematic search.

## Caching with LRUCache

`quran-search-engine` ships a generic `LRUCache<K, V>` class that you can pass into `search()` to avoid recomputing
identical queries. The cache uses JavaScript `Map` internally for **O(1)** `get`, `set`, and eviction.

### Why use it?

- **Instant repeat lookups** — paginating through pages 2, 3, … of the same query won't re-run the search pipeline.
- **Range Queries:** Range parsing intercepts numeric combinations (e.g., `1:1-7` or `2:255`) and returns matched
  verses directly.
- **Semantic and subject search:** enable `{ semantic: true }` or `{ subject: true }` with the matching map in the
  context to get `matchType: 'semantic'` / `matchType: 'subject'` results.
- **Configurable capacity** — set the max number of cached results to control memory.
- **Zero setup** — create the cache once, pass it to every `search()` call.

### LRUCache API

```ts
import { LRUCache } from 'quran-search-engine';

const cache = new LRUCache<string, any>(100); // capacity = 100 entries

cache.set('key', value); // Store a value
cache.get('key'); // Retrieve (moves to most-recent)
cache.has('key'); // Check existence
cache.delete('key'); // Remove one entry
cache.clear(); // Remove all entries
cache.size; // Current number of entries
```

When the cache reaches capacity, the **least recently used** entry is automatically evicted.

### Using with `search()`

Pass the cache as the **6th argument** to `search()` (`preComputedFuseIndex` is 5th — pass `undefined` if not using it):

```ts
import { search, LRUCache } from 'quran-search-engine';
import type { SearchResponse, QuranText } from 'quran-search-engine';

// Create once (e.g., at app startup or module scope)
const searchCache = new LRUCache<string, SearchResponse<QuranText>>(50);

// Every search call reuses the same cache
function handleSearch(query: string, page: number) {
  return search(
    query,
    { quranData, morphologyMap, wordMap },
    { lemma: true, root: true },
    { page, limit: 20 },
    undefined, // 5th — preComputedFuseIndex (optional)
    searchCache, // 6th — cache instance
  );
}

// First call for "الله" page 1 — computed
const r1 = handleSearch('الله', 1);

// Same query + same page — returned from cache (same object reference)
const r2 = handleSearch('الله', 1);
console.log(r1 === r2); // true

// Different page — computed and cached separately
const r3 = handleSearch('الله', 2);
console.log(r1 === r3); // false

// Different query — computed and cached separately
const r4 = handleSearch('الحمد', 1);
console.log(searchCache.size); // 3
```

### Cache key behavior

The cache key is derived from `JSON.stringify({ query, options, pagination })`. Two calls produce a cache hit only when
**all three** match exactly:

| Parameter    | Different value = different cache entry |
| ------------ | --------------------------------------- |
| `query`      | `"الله"` vs `"الحمد"`                   |
| `options`    | `{ lemma: true }` vs `{ lemma: false }` |
| `pagination` | `{ page: 1 }` vs `{ page: 2 }`          |

### Without cache (backward compatible)

The cache parameter is fully optional. Omit it and `search()` works exactly as before:

```ts
// No cache — works the same as always
const result = search('الله', { quranData, morphologyMap, wordMap });
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
  fuzzy?: boolean; // default: true
  semantic?: boolean;
  subject?: boolean;
  isRegex?: boolean;
  suraId?: number;
  juzId?: number;
  suraName?: string; // scopes query matches to a sura; does not list the whole sura
  sura_name_en?: string; // alias for suraName
  sura_name_romanization?: string; // alias for suraName
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
export type MatchType =
  | 'exact'
  | 'lemma'
  | 'root'
  | 'fuzzy'
  | 'range'
  | 'none'
  | 'semantic'
  | 'subject'
  | 'regex';
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

### `InvertedIndex`

Container for the pre-built lookup maps returned by `buildInvertedIndex()`:

```ts
import type { InvertedIndex, LemmaIndex, RootIndex, WordIndex } from 'quran-search-engine';

// LemmaIndex: normalized lemma → Set of verse GIDs
type LemmaIndex = Map<string, Set<number>>;

// RootIndex: normalized root → Set of verse GIDs
type RootIndex = Map<string, Set<number>>;

// WordIndex: normalized word → Set of verse GIDs
type WordIndex = Map<string, Set<number>>;

type SubjectIndex = Map<string, Set<number>>;

type InvertedIndex = {
  lemmaIndex: LemmaIndex;
  rootIndex: RootIndex;
  wordIndex: WordIndex;
  semanticIndex?: Map<string, Set<number>>;
  subjectIndex?: SubjectIndex;
};
```

## Non-goals

This library does not aim to provide:

- Advanced AI or semantic interpretation beyond synonym mapping
- Tafsir or meaning inference
- Opinionated UI rendering
- Server-side indexing infrastructure

It focuses strictly on deterministic Quran text search with basic semantic synonym support.

## Example apps

Several example applications are available in the `examples/` directory:

- **React + Vite**: Full search UI with highlighting, pagination, worker, subject and multi-term search
  (`examples/vite-react`)
- **Vanilla TypeScript**: Framework-free search with worker, subject and multi-term search (`examples/vanilla-ts`)
- **Angular**: Standalone Angular app with highlighting, worker, subject and multi-term search (`examples/angular`)
- **Node.js**: Server-side search demonstrating subject and multi-term search from the command line
  (`examples/nodejs`)

The bundled [CLI](#cli) is another way to try the engine without writing any code:
`npx quran-search-engine "رحم"`.

### Production Examples

These are real-world applications built with `quran-search-engine`:

- **[Open-Mushaf Native](https://github.com/adelpro/open-mushaf-native)**: A modern Quran Mushaf application built with
  Expo and React Native. Features offline Quran reading, gesture-based page navigation, and dynamic Tafseer popups with
  optimized image caching.

- **[quran-search-engine-example](https://github.com/adelpro/quran-search-engine-example)**: A minimal React +
  TypeScript + Vite template demonstrating Fast Refresh and production-ready ESLint configuration for Quran search
  applications.

### MCP Server

Use the search engine as a [Model Context Protocol](https://modelcontextprotocol.io/) server
to integrate Quran search capabilities into AI agents and assistants.

- **[quran-search-engine-mcp](https://github.com/adelpro/quran-search-engine-mcp)**: MCP server
  implementation providing Quran search tools to any MCP-compatible AI client.

To run an example:

```bash
# Setup: install dependencies and build the library
yarn playground:setup

# Run individual examples
yarn playground:react     # React + Vite
yarn playground:vanilla   # Vanilla TypeScript
yarn playground:angular  # Angular
yarn playground:node     # Node.js CLI
```

## Testing

This project includes comprehensive test coverage and verification tools.

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with coverage
yarn test --coverage
```

### Test Coverage

The test suite covers:

- **Core Search Logic**: `search()` and `simpleSearch()` functions
- **Inverted Index**: `buildInvertedIndex()` — lemma/root/word index construction and GID lookups
- **Tokenization**: Exact, lemma, and root matching algorithms
- **Arabic Normalization**: Text processing utilities (`removeTashkeel`, `normalizeArabic`)
- **Data Loading**: Quran data, morphology, and word map loading utilities
- **Highlighting**: UI-agnostic highlight range generation

**Note**: These are **unit tests** that test individual functions in isolation. For integration testing, see the
Verification Script below.

### Example End-to-End Tests

For browser-level verification of the example applications, run:

```bash
# Build the library first
yarn build

# Start the example dev servers (if needed) and run real browser checks
yarn test:e2e:examples
```

The Puppeteer suite loads the React, Vanilla TypeScript, and Angular examples, runs exact,
multi-term, subject, range-scoped, and boolean searches through the real UI, verifies range/filter
intersection and that the Web Worker path is active, and fails on page or request errors. See
[docs/guides/examples.md](docs/guides/examples.md#end-to-end-checks) for production-bundle testing
with custom URLs.

## Performance Optimization (Advanced)

### Pre-building the Inverted Index

By default, `search()` performs O(n) linear scans through all morphology entries on every lemma/root lookup. For
production apps, build the inverted index once and pass it through the context for O(1) lookups.

```ts
import {
  buildInvertedIndex,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  loadSemanticData,
  loadSubjectData,
  search,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap, semanticMap, subjectMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
  loadSubjectData(),
]);

// Build once — replaces O(n) scans with O(1) lookups
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

// Pass it through the context on every search
const result = search(
  'الرحمن',
  { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex },
  { lemma: true, root: true },
  { page: 1, limit: 20 },
);
```

There is no bundled pre-built index to load in v0.4.0; build it from the datasets once at
startup and reuse the result.

**Combining all optimizations** (recommended for production):

```ts
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadSubjectData,
  buildInvertedIndex,
  createArabicFuseSearch,
  LRUCache,
  search,
} from 'quran-search-engine';
import type { SearchResponse, QuranText } from 'quran-search-engine';

// Load everything in parallel
const [quranData, morphologyMap, wordMap, semanticMap, subjectMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
  loadSubjectData(),
]);

const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

// Pre-compute Fuse index (skips the ~5-20ms rebuild per keystroke)
const fuseIndex = createArabicFuseSearch(Array.from(quranData.values()), ['standard', 'uthmani']);

// Shared LRU cache (instant repeat queries)
const cache = new LRUCache<string, SearchResponse<QuranText>>(50);

// All optimizations active
const result = search(
  query,
  { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex },
  { lemma: true, root: true, fuzzy: true },
  { page: 1, limit: 20 },
  fuseIndex, // skip Fuse rebuild
  cache, // instant cache hit
);
```

### Pre-computing the Fuse Index

By default, `search()` builds a new Fuse.js index on every call if fuzzy search is enabled. For high-performance
applications (e.g., real-time search as you type), you can pre-compute the index and pass it to `search`.

```ts
import { search, createArabicFuseSearch } from 'quran-search-engine';

// 1. Create the index once (e.g., in useMemo or at app startup)
const fuseIndex = createArabicFuseSearch(Array.from(quranData.values()), ['standard', 'uthmani']);

// 2. Pass it to search
const results = search(
  query,
  { quranData, morphologyMap, wordMap },
  options,
  pagination,
  fuseIndex, // ← pre-computed index
  cache, // ← optional cache
);
```

This avoids rebuilding the index (~5-20ms) on every keystroke.

For benchmarking, memory profiling, worker offloading, and runnable benchmark scripts, see the [Performance Guide](docs/reference/performance.md).

**Key Differences from Unit Tests:**

- **Scope**: Integration test vs. isolated unit tests
- **Dependencies**: Tests real data loading and full function pipelines
- **Performance**: Measures actual loading times and search performance
- **End-to-End**: Validates the complete user workflow from data to results
- **Purpose**: Catches integration issues that unit tests might miss

### Test Structure

```bash
src/
├── core/
│   ├── range-parser.test.ts # Range search parsing tests
│   ├── search.test.ts       # Search algorithm, inverted index, LRU cache, and Fuse tests
│   ├── lru-cache.test.ts    # LRU cache tests
│   └── tokenization.test.ts # Token matching tests
├── utils/
│   ├── loader.test.ts       # Data loading tests
│   ├── normalization.test.ts # Text processing tests
│   └── highlight.ts         # Highlighting utilities
└── worker/
    └── searchWorkerClient.test.ts # Worker client + fallback tests
```

## Development

```bash
yarn run lint
yarn run test
yarn run build
```

## Contributing

- Open an issue to discuss larger changes before starting implementation.
- Keep changes focused and include tests when applicable.
- Ensure checks pass locally: `yarn run lint && yarn run test && yarn run build`.

## Contact

- Adel Benyahia — <contact@adelpro.us.kg>

## Acknowledgments

Special thanks to the [ITQAN Community](https://community.itqan.dev) for their support and contribution to the Quran
technology ecosystem.

<p align="center">
  <a href="https://itqan.dev">
    <img src="./assets/itqan-logo.svg" alt="ITQAN Community Logo" width="150" />
  </a>
</p>

## License

MIT
