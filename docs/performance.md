# Performance Scaling

`quran-search-engine` optimizes heavy Morphological Arabic mapping via dictionaries rather than linear looping.

## Speed Profile

In a standard Node.js or Javascript browser loop, iterating through > 6,000 index objects looking for complex string patterns is slow and locks up the Main Thread.

The engine relies on pre-constructed `Map` and `dict` configurations logic.
Because `morphologyMap` indexes verses directly by their native integer `gid`, operations like Lemma lookups operate statically instantly.
Because `wordMap` maps individual Tokens -> `{root, lemma}`, token checking happens instantly without traversing a multi-megabyte linguistic library on the fly.

## Inverted Indices & Pre-computation

Instead of checking 6000 verses for every query token individually, matching heavily relies on an `InvertedIndex` structure (`LemmaIndex`, `RootIndex`, `WordIndex`). This pre-computation step ensures that `O(N)` scans over the Quran text are reduced drastically to `O(1)` Set discoveries. When `wordMap` identifies a query token's Root, the `InvertedIndex` immediately provides the exact Set of Verse GIDs matching it.

## Internal LRU Caching

String normalization `(normalizeArabic)` and fuzzy metric operations can be expensive when repeated rapidly by users making slight spelling corrections. To combat this overhead silently, the library wraps its heaviest operations in lightweight `LRUCache` logic. When a repeated query or duplicate token is fired, the pre-computed operations return instantly from the cache, bypassing string manipulation.

## Regex Search Performance

When `{ isRegex: true }` is enabled, the engine bypasses inverted indices and performs a linear scan over the verse dataset. Each verse's normalized `standard` text is tested against the compiled regex. While this is `O(n)` per query, the engine optimizes performance by:

- **Filtering first:** When `suraId`, `juzId`, or `suraName` is provided, the verse set is narrowed before the regex runs, reducing the scan size significantly.
- **ReDoS protection:** Patterns containing nested quantifiers or overlapping alternation are rejected at validation time, preventing catastrophic backtracking that could freeze the event loop.

For most regex patterns, scanning 6,236 verses completes in single-digit milliseconds.

## The Cost

This speed trades against raw Memory Profile.
Loading all Maps sequentially (including the large corpus of Lemmas/Roots) requires caching multiple JSON datasets. When running via edge endpoints (like CloudFlare Workers or Vercel Edge functions), take care that the initialized context maps are properly instantiated in isolated global memory between cold boots to not run out of limited lambda execution times or memory limits.
