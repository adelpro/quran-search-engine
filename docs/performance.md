# Performance Scaling

`quran-search-engine` optimizes heavy Morphological Arabic mapping via dictionaries rather than linear looping.

## Speed Profile

In a standard Node.js or Javascript browser loop, iterating through > 6,000 index objects looking for complex string patterns is slow and locks up the Main Thread.

The engine relies on pre-constructed `Map` and `dict` configurations logic.
Because `morphologyMap` indexes verses directly by their native integer `gid`, operations like Lemma lookups operate statically instantly.
Because `wordMap` maps individual Tokens -> `{root, lemma}`, token checking happens instantly without traversing a multi-megabyte linguistic library on the fly.

## The Cost

This speed trades against raw Memory Profile.
Loading all Maps sequentially (including the large corpus of Lemmas/Roots) requires caching multiple JSON datasets. When running via edge endpoints (like CloudFlare Workers or Vercel Edge functions), take care that the initialized context maps are properly instantiated in isolated global memory between cold boots to not run out of limited lambda execution times or memory limits.
