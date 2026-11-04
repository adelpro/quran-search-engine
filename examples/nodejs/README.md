# Node.js Example

A Node.js (ESM) example demonstrating the v0.4.0 `quran-search-engine` API for server-side
usage.

The example imports `quran-search-engine` through the Yarn workspace (`workspace:*`), so it
always runs against the local `0.4.0` build.

## Features

- Load every dataset: Quran text, morphology, word map, semantic map, phonetic map, and subjects
- Build the inverted index once with `buildInvertedIndex(..., subjectMap, wordMap)`
- Exact, lemma, root, fuzzy, phonetic, semantic, and subject search
- Boolean queries with `+term`, `-term`, and `term | term`
- Multi-term search with `rankBy: 'score' | 'coverage' | 'frequency'`
- Range lookups (`2:255`, `1:1-7`, `2:`)
- Regex search with `validateRegex()`
- Pre-computed Fuse index and LRU cache
- Highlight ranges and JSON/CSV/TSV export helpers

## Getting Started

1. Install dependencies and build the library:

   ```bash
   yarn playground:setup
   ```

2. Run the example:

   ```bash
   yarn playground:node
   ```

3. Run a custom search:

   ```bash
   yarn workspace nodejs-example start "الله"
   yarn workspace nodejs-example start "+الله -الرحمن"
   yarn workspace nodejs-example start "[محمد, يونس]"
   ```

## What it demonstrates

| Section           | API                                                    |
| ----------------- | ------------------------------------------------------ |
| Standard search   | `search(query, context, options, pagination)`          |
| Subject search    | `loadSubjectData()`, `subjectMap`, `{ subject: true }` |
| Multi-term search | `search(string[], context, options, { rankBy })`       |
| Range lookup      | `search('2:255', context)`                             |
| Boolean helpers   | `hasBooleanOperators()`, `clearBooleanOperators()`     |
| Highlight/export  | `getHighlightRanges()`, `exportResults()`              |
| Regex             | `validateRegex()`, `{ isRegex: true }`                 |
| Caching           | `LRUCache`, pre-computed Fuse index                    |
| Metadata          | `SURAS`, `normalizeArabic()`                           |

## Output Example

```text
🚀 Loading Quran Search Engine data...

✅ Loaded 6236 verses
✅ Loaded morphology data for 6236 verses
✅ Loaded word map with 18005 entries
✅ Loaded semantic data with 3180 entries
✅ Loaded phonetic data with 31417 entries
✅ Loaded subject data with 488 entries

✅ Built inverted index in 185ms
   - Lemma entries:    4,282
   - Root entries:     1,642
   - Word entries:     14,667
   - Semantic entries: 3,138
   - Subject entries:  488

🔍 "climate" — subject (thematic) search
──────────────────────────────────────────────────
📊 Found 127 matches
   Counts: subject 127 · total 127
   1. البقرة (2:164) — subject
      إِنَّ فِی خَلۡقِ ٱلسَّمَٰوَٰتِ وَٱلۡأَرۡضِ ...
──────────────────────────────────────────────────
```

## Notes

- `loadQuranData()` returns `Map<number, QuranText>`, not an array.
- `buildInvertedIndex()` takes `(morphologyMap, quranData, semanticMap?, subjectMap?, wordMap?)`.
- Boolean operators are symbols. The words `AND`, `OR`, and `NOT` are not operators; non-Arabic
  text is stripped before searching, so `الله NOT الرحمن` behaves like `الله الرحمن`.
- Passing `invertedIndex` uses exact-token matching; the linear-scan fallback uses substring
  matching, so counts can differ between the two paths.
