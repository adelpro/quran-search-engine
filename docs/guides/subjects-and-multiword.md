# Subject & Multi-Word Search

This guide covers two complementary features for broader Quranic search:

- **Subject search** — thematic search that maps an English concept word to a curated set of Arabic
  lemmas (e.g. `"climate"` → verses about rain, wind, and storms)
- **Multi-word search** — independent multi-term search that runs each word through the full
  pipeline and merges the results with score/coverage/frequency ranking (e.g.
  `['محمد', 'يونس', 'إبراهيم']`)

---

## Subject Search

### How subjects differ from the semantic map

The **semantic map** (`loadSemanticData`) links individual words to linguistic synonyms and related
concepts — it is a per-word thesaurus.

The **subject map** (`loadSubjectData`) organises Arabic lemmas into _thematic groups_ keyed by an
English concept word. A single subject key can cover dozens of lemmas that belong to the same
Islamic topic even when they share no morphological root.

|             | Semantic map                 | Subject map                                           |
| ----------- | ---------------------------- | ----------------------------------------------------- |
| Key         | Arabic or English word       | English concept (topic name)                          |
| Value       | Synonymous Arabic words      | All Arabic lemmas relevant to the theme               |
| Match logic | Word-level synonym expansion | Root / lemma / clitic matching across the theme group |
| Best for    | Lexical synonyms             | Thematic / conceptual search                          |

**Practical difference** — searching `"climate"` with `{ semantic: true }` returns zero results
because the semantic map has no entry for the English word _climate_. With `{ subject: true }` the
engine looks up the _weather_ subject group and returns every verse whose text contains any lemma
in that group:

```ts
// ❌ Zero hits — semantic map has no 'climate' entry
search('climate', context, { lemma: true, root: true, semantic: true });

// ✅ Weather-themed verses — subject map covers it
search('climate', context, { lemma: true, root: true, subject: true });
// → verses containing roots/lemmas for: مطر، رياح، عاصفة، سحاب، برق، رعد …
```

### Loading subject data

```ts
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

// Pass subjectMap (and wordMap) so buildInvertedIndex pre-builds the subjectIndex.
// wordMap lets each subject word resolve through its root — مطر also covers وأمطرنا.
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

const context = { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex };
```

### Performing a subject search

```ts
const response = search(
  'climate',
  context,
  { lemma: true, root: true, subject: true },
  { page: 1, limit: 20 },
);

response.results.forEach((v) => {
  console.log(v.sura_id, v.aya_id, v.matchType); // matchType === 'subject'
});
```

> English concept queries skip the phonetic transliteration layer, so `"climate"` is resolved by
> the subject map rather than fuzzy-matched to an unrelated Arabic word. This keeps
> `--subject climate` limited to the weather theme instead of returning unscored fuzzy hits.

Any English alias listed under the subject key triggers the same group:

```ts
search('rain', context, { lemma: true, root: true, subject: true }); // weather group
search('storm', context, { lemma: true, root: true, subject: true }); // weather group
search('worship', context, { lemma: true, root: true, subject: true }); // worship group → صلاة، زكاة، حج …
```

### Extending the subject map

The seed file `src/data/subjects.json` ships 20 Islamic themes. Each entry follows this schema:

```json
{
  "subject": "weather",
  "english": ["weather", "climate", "atmosphere", "rain", "storm"],
  "arabic": ["مطر", "رياح", "عاصفة", "سحاب", "برق", "رعد"]
}
```

To add a new theme:

1. Copy any existing entry as a template.
2. Set `"subject"` to a unique snake_case name.
3. List English aliases in `"english"` — all lowercase, no punctuation.
4. List Arabic words in `"arabic"` — **use unvowelled base forms** (`مطر`, not `أمطار`). The
   engine resolves each word through its root, so `مطر` already covers `وأمطرنا`, `أمطرنا`, and
   `مطرًا`. Listing derived forms adds nothing and may introduce words that do not appear in the
   Quran at all.
5. Reload the page or restart the server — `loadSubjectData()` re-reads the JSON on the next call.

> **Note:** `src/data/subjects.json` is a seed dataset. It covers 20 themes and is meant to grow
> with community contributions. If you find a missing theme or incorrect Arabic words, opening a PR
> is the best way to improve it for everyone.

---

## Multi-Word Search

### AND logic vs independent search

Passing a **string** to `search()` applies AND logic across all tokens — every word in the query
must appear in the verse:

```ts
// AND logic — only returns verses containing BOTH الله AND الرحمن
search('الله الرحمن', context, { lemma: true, root: true });
```

Passing a **string array** instead runs each term independently through the full pipeline (exact →
lemma → root → fuzzy → semantic) and then merges results by verse `gid`:

```ts
// Independent search — returns verses matching ANY of the three names
search(['محمد', 'يونس', 'إبراهيم'], context, { lemma: true, root: true });
```

TypeScript dispatches the right return type automatically — `SearchResponse` for a string,
`MultiTermResponse` for an array. No separate function to import.

### Result shape

Each result in a `MultiTermResponse` extends `ScoredVerse` with three extra fields:

```ts
type MergedSearchResult<TVerse> = ScoredVerse<TVerse> & {
  matchedTerms: string[]; // which input terms matched this verse
  distinctTermCount: number; // matchedTerms.length
  totalFrequency: number; // total hit count across all matching terms
};
```

### Ranking modes

Pass `rankBy` in the fourth argument to control sort order:

| `rankBy`            | Sorts by                                        | Use case                                 |
| ------------------- | ----------------------------------------------- | ---------------------------------------- |
| `'score'` (default) | Accumulated `matchScore`                        | Overall relevance                        |
| `'coverage'`        | `distinctTermCount`, tie-broken by `matchScore` | Verses touching the most of your terms   |
| `'frequency'`       | `totalFrequency`, tie-broken by `matchScore`    | Verses with the most raw word-level hits |

```ts
// Find verses mentioning the most prophets
search(
  ['محمد', 'يونس', 'إبراهيم', 'موسى', 'عيسى'],
  context,
  { lemma: true, root: true },
  { page: 1, limit: 10, rankBy: 'coverage' },
);
// → verses mentioning the highest number of distinct prophet names float to the top

// Find the verse with the highest raw term frequency
search(
  ['الله', 'رب'],
  context,
  { lemma: true, root: true },
  { page: 1, limit: 10, rankBy: 'frequency' },
);
```

### AI pipeline example

A common pattern is using an LLM to expand a conceptual query into a list of keywords, then
passing the result directly to `search()`:

```ts
// LLM output for the prompt "list the prophets mentioned in the Quran"
const prophets = ['محمد', 'يونس', 'إبراهيم', 'موسى', 'عيسى', 'نوح', 'آدم'];

const response = search(
  prophets,
  context,
  { lemma: true, root: true },
  { page: 1, limit: 20, rankBy: 'coverage' },
);

// Each result shows which prophets appear in that verse
response.results.forEach((v) => {
  console.log(`${v.sura_id}:${v.aya_id} — ${v.matchedTerms.join(', ')}`);
});
```

---

## Combining both features

Subject search and multi-word search are independent options. They can be used together when
`subjectMap` is in the context:

```ts
// Verses relevant to both worship and knowledge themes
const response = search(
  ['worship', 'knowledge'],
  context,
  { lemma: true, root: true, subject: true },
  { page: 1, limit: 20, rankBy: 'coverage' },
);
```

---

## See also

- [Search Syntax & Scoring](./search-syntax.md) — full multi-term API reference and ranking details
- [Advanced Configuration](./configuration.md) — `SearchOptions` type reference
- [Migration Guide](../migration-guide.md) — upgrading from v0.3.x to v0.4.x
