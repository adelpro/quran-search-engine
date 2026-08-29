# Quick Start

The fastest way to initialize `quran-search-engine` is to load the necessary structured datasets, initialize the engine,
and pass a query string.

> Note: this example requires an async environment (Node 18+, ESM, browsers).

## TypeScript Environment setup

```typescript
import {
  search,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  type SearchResponse,
} from 'quran-search-engine';

// 1. Parallel Load all Datasets natively
const [quranData, morphologyMap, wordMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);

// 2. Query and Pass Maps to search()
const response: SearchResponse = search('الله الرحمن', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,
  fuzzy: true,
});

// 3. Iterate through highly scored verse matches
response.results.forEach((verse) => {
  console.log(
    `Sura: ${verse.sura_id} | Aya: ${verse.aya_id} | Match: ${verse.matchType} | Score: ${verse.matchScore}`,
  );
});
```

### Response Shape Output Example

```sh
1 1 exact 6
1 3 lemma 4
```

## JavaScript (Node ESM Setup)

```javascript
import { search, loadMorphology, loadQuranData, loadWordMap } from 'quran-search-engine';

const [quranData, morphologyMap, wordMap] = await Promise.all([
  loadQuranData(),
  loadMorphology(),
  loadWordMap(),
]);

const response = search('الله الرحمن', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,
});

console.log(response.results[0]);
```

## Regex Search

Search using regular expressions by passing `{ isRegex: true }`:

```typescript
const response = search('^.*ون$', quranData, morphologyMap, wordMap, {
  lemma: false,
  root: false,
  isRegex: true,
});

response.results.forEach((verse) => {
  console.log(`${verse.sura_id}:${verse.aya_id} — ${verse.matchType}`);
});
```

The engine validates regex patterns for correctness and rejects unsafe patterns (e.g. nested quantifiers) to prevent
catastrophic backtracking.
