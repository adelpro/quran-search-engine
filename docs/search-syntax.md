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
