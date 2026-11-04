# Quick Start

Get from zero to a scored Quran search in a few lines. This example requires an async
environment (Node 18+, ESM, or a browser).

## TypeScript setup

```typescript
import {
  search,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  loadSemanticData,
  buildInvertedIndex,
  type SearchResponse,
} from 'quran-search-engine';

// 1. Load the datasets in parallel.
// loadQuranData() returns a Map<gid, QuranText>, not an array.
const [quranData, morphologyMap, wordMap, semanticMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
  loadSemanticData(),
]);

// 2. Build the inverted index once, then reuse it.
const invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap);

// 3. Search with a context object.
const response: SearchResponse = search(
  'الله الرحمن',
  { quranData, morphologyMap, wordMap, semanticMap, invertedIndex },
  { lemma: true, root: true, fuzzy: true },
  { page: 1, limit: 20 },
);

// 4. Render the scored verses.
response.results.forEach((verse) => {
  console.log(`${verse.sura_id}:${verse.aya_id} — ${verse.matchType} (${verse.matchScore})`);
});
```

### Response shape

```typescript
type SearchResponse = {
  results: ScoredVerse[];
  counts: {
    simple: number;
    lemma: number;
    root: number;
    fuzzy: number;
    range: number;
    semantic: number;
    subject: number;
    regex: number;
    total: number;
  };
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};
```

## JavaScript (Node ESM)

```javascript
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
  { lemma: true, root: true },
);

console.log(response.results[0]);
```

## Subject (thematic) search

Load `subjectMap` with `loadSubjectData()` and pass it to both the index and the context:

```typescript
import { loadSubjectData, buildInvertedIndex, search } from 'quran-search-engine';

const subjectMap = await loadSubjectData();
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap, // 5th argument: enables root-based subject matching
);

const context = { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex };

const themed = search('climate', context, {
  lemma: true,
  root: true,
  subject: true,
});
// themed.results[i].matchType === 'subject'
```

See [Subject & Multi-Word Search](./subjects-and-multiword.md) for the full dataset format and
matching rules.

## Multi-term search

Pass an array to search each term independently and merge the results by verse:

```typescript
const prophets = search(
  ['محمد', 'يونس', 'إبراهيم'],
  context,
  { lemma: true, root: true },
  { page: 1, limit: 10, rankBy: 'coverage' },
);

prophets.results.forEach((verse) => {
  console.log(`${verse.sura_id}:${verse.aya_id} — ${verse.matchedTerms.join(', ')}`);
});
```

`rankBy` is `'score'` (default), `'coverage'`, or `'frequency'`.

## Regex search

Search using regular expressions by passing `{ isRegex: true }`. Regex mode bypasses the
linguistic layers and matches the normalized `standard` text directly.

```typescript
const response = search(
  '^.*ون$',
  { quranData, morphologyMap, wordMap },
  { lemma: false, root: false, isRegex: true },
);

response.results.forEach((verse) => {
  console.log(`${verse.sura_id}:${verse.aya_id} — ${verse.matchType}`);
});
```

Patterns are validated for syntax and rejected when they match known ReDoS-prone shapes such
as nested quantifiers.

## Next steps

- [CLI](./cli.md) — search from a terminal with no code
- [Search Syntax & Scoring](./search-syntax.md) — operators, ranges, scoring, multi-term
- [Subject & Multi-Word Search](./subjects-and-multiword.md) — thematic search and ranking
- [Configuration](./configuration.md) — every option and type
- [Migration Guide](../migration-guide.md) — upgrading from v0.3.2
