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

#### Boolean Search Helper Functions

The library exposes two utility functions for working with boolean queries:

##### `hasBooleanOperators(query)`

Checks if a query string contains boolean operators (`+`, `-`, `|`).

```typescript
import { hasBooleanOperators } from 'quran-search-engine';

hasBooleanOperators('+الله -الرحمن'); // Returns: true
hasBooleanOperators('الله الرحمن');    // Returns: false
```

##### `clearBooleanOperators(query)`

Removes all boolean operators from a query and normalizes whitespace. Useful for creating a clean fallback query when boolean mode isn't enabled.

```typescript
import { clearBooleanOperators } from 'quran-search-engine';

clearBooleanOperators('+الله | الرحمن -الجحيم');
// Returns: 'الله الرحمن الجحيم'

clearBooleanOperators('محمد | رسول');
// Returns: 'محمد رسول'
```

- **Semantic Filtering:** For integrations with LLM and embeddings, boolean flags allow the engine to return `matchType: semantic` metadata gracefully.

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
