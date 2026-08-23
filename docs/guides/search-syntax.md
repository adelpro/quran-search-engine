# Search Syntax

`quran-search-engine` processes incoming queries using string tokenization and **AND logic** intersecting.

## AND Logic Requirements

When submitting multi-word queries, the query string is broken down.

- **Normalization:** The engine cleans the text removing Arabic diacritics using internal Normalizer tools.
- **Whitespace Tokenization:** The clean query string is split by all whitespaces.

The engine intersects matches **per token**. This guarantees all returned results successfully fulfilled _every_ query term either by exact match, lemma fallback, root fallback, or fuzzy match fallback conditionally based on configuration.

```typescript
const response = search('الله الرحمن', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,
});
// Internally:
// Token 1 => Matches 'الله'
// AND
// Token 2 => Matches 'الرحمن'
// Result => Sura 1:1, 1:3, etc.
```

## Advanced Search Types

Beyond multi-word string queries, the engine supports multiple alternative syntaxes enabled via the `SearchOptions`:

- **Regex Queries:** When `{ isRegex: true }` is supplied, the engine bypasses standard string tokenization and matches verses via native RegExp operations directly on the normalized `standard` text field. The query string is compiled as a Unicode-aware `RegExp` and tested against each verse. Pattern validation includes syntactic correctness checks and heuristic ReDoS detection (nested quantifiers, overlapping alternation) to reject patterns that could cause catastrophic backtracking. Matched verses receive `matchType: 'regex'` with a score of `1`. Regex search also respects `suraId`, `juzId`, and `suraName` filtering — the verse set is narrowed first, then the regex runs only on the filtered subset.

```typescript
// Find all verses ending with "ون"
const response = search('^.*ون$', quranData, morphologyMap, wordMap, {
  lemma: false,
  root: false,
  isRegex: true,
});

// Find verses containing "الله" followed by "الرحمن" with any text between them
const response2 = search('الله.*الرحمن', quranData, morphologyMap, wordMap, {
  lemma: false,
  root: false,
  isRegex: true,
});
```

- **Range Queries:** Range parsing intercepts numeric combinations (e.g., `1:1-7` or `2:255`) returning matched verse targets efficiently without iterating.
- **Boolean Search:** When `{ isBoolean: true }` is enabled, the engine uses a sophisticated boolean expression parser. This supports `AND`, `OR`, `NOT` operators and nested grouping with `()`. It allows for complex queries like `(الله OR رب) AND (الرحمن NOT الرحيم)`.
  - **AND**: Intersection of results. Both terms must match.
  - **OR**: Union of results. Either term can match.
  - **NOT**: Exclusion of results. The term must not match.
  - **Grouping**: Controls precedence, e.g., `A AND (B OR C)`.

### Boolean Search Helper Functions

The library exposes two utility functions for working with boolean queries:

#### `hasBooleanOperators(query)`

Checks if a query string contains boolean operators (`+`, `-`, `|`).

```typescript
import { hasBooleanOperators } from 'quran-search-engine';

hasBooleanOperators('+الله -الرحمن'); // Returns: true
hasBooleanOperators('الله الرحمن'); // Returns: false
```

#### `clearBooleanOperators(query)`

Removes all boolean operators from a query and normalizes whitespace. Useful for creating a clean fallback query when boolean mode isn't enabled.

```typescript
import { clearBooleanOperators } from 'quran-search-engine';

clearBooleanOperators('+الله | الرحمن -الجحيم');
// Returns: 'الله الرحمن الجحيم'

clearBooleanOperators('محمد | رسول');
// Returns: 'محمد رسول'
```

- **Semantic Filtering:** For integrations with LLM and embeddings, boolean flags allow the engine to return `matchType: semantic` metadata gracefully.

## Multi-Term Search (`search()` with an array)

`search()` always applies **AND logic** for a single query string: a multi-word query like
`'الله الرحمن'` only returns verses containing _both_ words together (see
[AND Logic Requirements](#and-logic-requirements) above). Sometimes you want the opposite —
search for several unrelated terms independently and see which verses matched any of them, and
how well. For that, call `search()` with an **array of terms** instead of a single string:

```typescript
import { search } from 'quran-search-engine';

const response = search(['محمد', 'يونس', 'إبراهيم'], context, {
  lemma: true,
  root: true,
});
```

`search()` is overloaded: pass a `string` and you get the normal AND-logic search
(`SearchResponse`); pass a `string[]` and you get the independent multi-term search described
here (`MultiTermResponse`). TypeScript picks the right return type automatically based on which
one you pass — no separate function to import.

### How it works

Passing an array does **not** rewrite your terms into a single `"محمد | يونس | إبراهيم"` query.
Instead, `search()` detects the array (via `Array.isArray`) and runs its normal single-query
pipeline once per term — independently, through the full pipeline (exact match, lemma, root,
fuzzy, semantic) — then merges the results by verse `gid`:

- A verse that matched only one term appears once, with that term's score.
- A verse that matched multiple terms appears once, with `matchScore` and hit counts **summed**
  across every term that matched it.
- Repeating the same term twice in the input list (`['محمد', 'محمد']`) still counts as one
  distinct term for coverage purposes, but its score/frequency contribution is added twice —
  reflecting that two real searches did each find it.

This matters because lemma/root/semantic matching is inherently per-term: rewriting
`['محمد', 'يونس']` into the boolean query `'محمد | يونس'` would lose the linguistic analysis each
individual term needs. Running `search()` separately for each term keeps that analysis intact.

### Result shape

Each result extends the normal `ScoredVerse` shape with three extra fields:

```typescript
type MergedSearchResult<TVerse> = ScoredVerse<TVerse> & {
  matchedTerms: string[]; // which input terms matched this verse
  distinctTermCount: number; // matchedTerms.length
  totalFrequency: number; // summed hit count across all matching terms
};
```

The overall response keeps the same `{ results, counts, pagination }` shape as `SearchResponse`
— see [`MultiTermResponse`](../reference/api/types.md#multitermresponsetverse).

### Ranking modes

Pass `rankBy` in the fourth argument (alongside `page`/`limit`) to control sort order:

| `rankBy`      | Sorts by                                        | Use case                                 |
| ------------- | ----------------------------------------------- | ---------------------------------------- |
| `'score'`     | Accumulated `matchScore` (default)              | Overall relevance                        |
| `'coverage'`  | `distinctTermCount`, tie-broken by `matchScore` | Verses touching the most of your terms   |
| `'frequency'` | `totalFrequency`, tie-broken by `matchScore`    | Verses with the most raw word-level hits |

`matchScore` itself never changes based on `rankBy` — it's always the sum of each contributing
term's own `search()` score. What changes is only how the merged array gets sorted:
`'score'` uses `matchScore` as its **only** sort key, with no fallback — verses tied on
`matchScore` keep whichever order they were first merged in. `'coverage'` and `'frequency'`
use `matchScore` strictly as a **tiebreaker**, after their own primary metric.

All three aggregate the same way — **sum across every contributing term**, not the maximum of
any single one. `distinctTermCount` is `matchedTerms.length` (how many distinct terms hit the
verse) and `totalFrequency` is the sum of each matching term's own hit count within that verse.
A verse hit twice by one term and once by another (`totalFrequency: 3`) ranks the same as a verse
hit once each by three different terms (`totalFrequency: 3`) — `'frequency'` measures total raw
hits, not any single term's strength.

```typescript
// Verses covering the most of your terms first
const byCoverage = search(
  ['محمد', 'يونس', 'إبراهيم'],
  context,
  { lemma: true, root: true },
  { rankBy: 'coverage', page: 1, limit: 10 },
);
```

### Signature

`search()` has two overloads — same function, dispatched by the type of `query`:

```typescript
// query: string — original single-query AND-logic search
search(
  query: string,
  context: SearchContext,
  options?: SearchOptions,
  pagination?: { page?: number; limit?: number },
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
): SearchResponse

// query: string[] — independent multi-term search, merged by gid
search(
  query: string[],
  context: SearchContext,
  options?: SearchOptions,
  multiTermOptions?: {
    page?: number;
    limit?: number;
    rankBy?: 'score' | 'coverage' | 'frequency';
  },
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
): MultiTermResponse
```

`options`, `fuseIndex`, and `cache` are forwarded as-is to every individual per-term search, so
anything that works with a single-string `search()` call — including `suraId`/`juzId`/`suraName`
filters and `semantic: true` — also works per-term here.

## String Checking For Arbitrary Filters

For developers requiring strict Boolean checks independent of scoring across any internal dataset.

```typescript
import { normalizeArabic } from 'quran-search-engine';

export function containsAllTokens(value: string, query: string): boolean {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return false;

  const tokens = normalizedQuery.split(/\s+/);
  const normalizedValue = normalizeArabic(value);
  return tokens.every((token) => normalizedValue.includes(token));
}
```
