# Migration Guide: v0.3.2 → v0.4.0

This guide covers upgrading from **v0.3.2** to **v0.4.0**. The release adds thematic
(subject) search, independent multi-term search, and a bundled CLI. Most existing calls keep
working unchanged; the breaking changes are limited to the `SearchCounts` and `MatchType`
types and to code that constructs those values by hand.

> Upgrading from v0.1.x or v0.2.x? Those releases changed the whole call shape
> (`search()` moved from positional arguments to a context object, and `quranData` became a
> `Map`). Follow the v0.3.x migration steps first, then apply this guide.

## What changed in v0.4.0

| Area | Change | Breaking? |
| ---- | ------ | --------- |
| Subject search | New `loadSubjectData()`, `subjectMap` context field, `{ subject: true }`, `matchType: 'subject'` | No |
| Multi-term search | `search()` accepts `string[]` and returns `MultiTermResponse` | No (new overload) |
| CLI | New `quran-search-engine` binary (`bin` in `package.json`) | No |
| Inverted index | `buildInvertedIndex()` now accepts `subjectMap` (4th) and `wordMap` (5th) | No (optional args) |
| Counts | `SearchCounts.subject` is now **required** | **Yes** |
| Match types | `MatchType` gained `'subject'` | **Yes** for exhaustive switches |
| Fuzzy counts | `counts.fuzzy` no longer includes unscored (`matchType: 'none'`) matches | Behavioural |
| Schema validators | `validateSubjectData()` and `validatePhoneticData()` exported | No |

---

## Breaking changes

### 1. `SearchCounts.subject` is required

Every response now reports subject matches. If you build a `SearchCounts` object literal
yourself (for an empty state, a stub, or a custom cache entry), add the field.

**Before (v0.3.2):**

```typescript
const emptyCounts: SearchCounts = {
  simple: 0,
  lemma: 0,
  root: 0,
  fuzzy: 0,
  range: 0,
  semantic: 0,
  regex: 0,
  total: 0,
};
```

**After (v0.4.0):**

```typescript
const emptyCounts: SearchCounts = {
  simple: 0,
  lemma: 0,
  root: 0,
  fuzzy: 0,
  range: 0,
  semantic: 0,
  subject: 0, // new, required
  regex: 0,
  total: 0,
};
```

Code that only *reads* counts (for example `response.counts.semantic`) needs no change, and
code that relies on `response.counts` from `search()` already receives the new field.

### 2. `MatchType` gained `'subject'`

If you exhaustively switch over `MatchType`, TypeScript will now report a missing case. Add
`'subject'` alongside the existing members.

**Before (v0.3.2):**

```typescript
function label(type: MatchType): string {
  switch (type) {
    case 'exact':
      return 'Exact';
    case 'lemma':
      return 'Lemma';
    case 'root':
      return 'Root';
    case 'fuzzy':
      return 'Fuzzy';
    case 'semantic':
      return 'Semantic';
    case 'regex':
      return 'Regex';
    case 'range':
      return 'Range';
    case 'none':
      return 'None';
  }
}
```

**After (v0.4.0):** add the new branch:

```typescript
    case 'subject':
      return 'Subject';
```

Non-exhaustive switches and string comparisons keep compiling unchanged.

### 3. `counts.fuzzy` changed meaning

`counts.fuzzy` now counts **genuine fuzzy matches only**. Verses that entered the result set
without any layer claiming them (`matchType: 'none'`) still appear in `counts.total`, but are
no longer added to `counts.fuzzy`. If you displayed "fuzzy" as "everything else", use
`counts.total - counts.simple - counts.lemma - counts.root - counts.semantic - counts.subject -
counts.range - counts.regex` when you need that number.

---

## Non-breaking additions

### Subject (thematic) search

`loadSubjectData()` returns a `Map<string, string[]>` that maps English concepts and Arabic
words to a curated group of Arabic lemmas.

```typescript
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadSubjectData,
  buildInvertedIndex,
  search,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap, semanticMap, subjectMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
  loadSubjectData(),
]);

// subjectMap is optional; passing it pre-builds subjectIndex.
// wordMap (5th argument) lets subject words resolve through their root.
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

const context = {
  quranData,
  morphologyMap,
  wordMap,
  semanticMap,
  subjectMap,
  invertedIndex,
};

const response = search('climate', context, { lemma: true, root: true, subject: true });
// → matchType: 'subject'
```

`subjectMap` is only required when `{ subject: true }` is used. If it is omitted, the option is
ignored and every other search layer runs normally.

### Multi-term search

Pass an array instead of a string to search each term independently and merge results by verse
`gid`:

```typescript
const response = search(
  ['محمد', 'يونس', 'إبراهيم'],
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20, rankBy: 'coverage' },
);
// response.results[i].matchedTerms / distinctTermCount / totalFrequency
```

`rankBy` accepts `'score'` (default), `'coverage'`, or `'frequency'`. The string overload is
unchanged.

### CLI

The package now ships a `quran-search-engine` command:

```bash
npx quran-search-engine "رحم"
npx quran-search-engine "climate" --subject
npx quran-search-engine "[محمد, يونس]" --rank-by coverage
quran-search-engine --help
```

See the [CLI guide](./guides/cli.md) for every flag, output format, and exit code.

### Schema validators

`validateSubjectData()` and `validatePhoneticData()` join the existing validators:

```typescript
import { validateSubjectData, formatSchemaErrors } from 'quran-search-engine';

const result = validateSubjectData(customSubjectArray);
if (!result.valid) console.error(formatSchemaErrors(result));
```

> The validators expect the **raw JSON shapes** (`subjects.json`, `phonetic.json`, …), not the
> `Map` instances returned by `loadSubjectData()` / `loadPhoneticData()`.

---

## Step-by-step upgrade

### Step 1: Install v0.4.0

```bash
yarn add quran-search-engine@0.4.0
# or: npm install quran-search-engine@0.4.0
```

### Step 2: Update hand-built `SearchCounts`

Search the codebase for `SearchCounts` object literals and add `subject: 0`. Reading counts
from `search()` needs no change.

### Step 3: Handle the `'subject'` match type

Search for `switch` statements and `Record<MatchType, ...>` maps. Add a `'subject'` case (or a
default branch). Non-exhaustive code needs no change.

### Step 4: Opt in to subject search (optional)

If you want thematic search:

1. Load `subjectMap` with `loadSubjectData()`.
2. Pass it to `buildInvertedIndex()` as the 4th argument and to the search context.
3. Pass `wordMap` as the 5th argument if you want root-based subject matching.
4. Set `{ subject: true }` in the options for the relevant searches.

### Step 5: Verify

```bash
yarn build
yarn test --run
yarn lint
```

The v0.4.0 test suite covers subject search, multi-term ranking, the CLI parser/formatter, and
the new validators.

---

## Complete example: v0.3.2 → v0.4.0

**Before (v0.3.2):**

```typescript
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  buildInvertedIndex,
  search,
} from 'quran-search-engine';

const [quranData, morphologyMap, wordMap, semanticMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
]);

const invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap);

const response = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap, semanticMap, invertedIndex },
  { lemma: true, root: true },
  { page: 1, limit: 20 },
);
```

**After (v0.4.0)** — same call, plus optional subject support:

```typescript
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadSubjectData,
  buildInvertedIndex,
  search,
} from 'quran-search-engine';

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

const context = { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex };

// Existing string search — unchanged
const normal = search(
  'الله الرحمن',
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20 },
);

// New: thematic search
const thematic = search('climate', context, { lemma: true, root: true, subject: true });

// New: independent multi-term search
const multi = search(
  ['محمد', 'يونس', 'إبراهيم'],
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20, rankBy: 'coverage' },
);
```

---

## Troubleshooting

### `Property 'subject' is missing ... but required in type 'SearchCounts'`

Add `subject: 0` to the object literal, or type the value as a partial/`Omit` if it is only a
stub.

### `Not all code paths return a value` after upgrading TypeScript

Your `MatchType` switch is exhaustive. Add a `'subject'` case.

### `climate` returns nothing with `{ subject: true }`

- Confirm `subjectMap` is in the context **and** in `buildInvertedIndex()`.
- Confirm the dataset ships `src/data/subjects.json` (20 themes in v0.4.0).
- If you use a custom dataset, validate it with `validateSubjectData()`.
- English lookups fall back to a strict fuzzy match, but only against keys that exist.

### Subject results are too broad or too narrow

Pass `wordMap` as the 5th argument to `buildInvertedIndex()` and in the context. Without it,
subject words resolve by lemma and clitic variants only, so root-derived forms such as
`وأمطرنا` will not be included for `مطر`.

---

## Need help?

Open an issue at
[github.com/adelpro/quran-search-engine/issues](https://github.com/adelpro/quran-search-engine/issues).
