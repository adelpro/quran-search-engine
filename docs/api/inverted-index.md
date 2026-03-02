# Inverted Index & Data Strategies

`quran-search-engine` employs sophisticated data strategies locally for lookup speed. We avoid massive memory overhead while retaining O(1) matching via `Map` dictionaries.

## Search Concept

Instead of looping through all 6000+ verses (O(N) search times), we utilize the `wordMap` dictionary.

### Data Types:

#### `QuranText`

Input dataset object defining attributes:

- `gid`: Unique Verse ID.
- `standard`: Simple exact text field for matching exact queries.
- `uthmani`: The base field commonly used for fuzzy fallbacks.

#### `MorphologyAya`

The preloaded morphology dataset. This is a `Map<number, MorphologyAya>`.
When matched, a query token uses `wordMap` to retrieve the possible `{ lemma, root }`. If a match object matches the Morphology map via Verse `gid`, it guarantees the verse contains the intended lemma/root match string without regular expressions.

#### `WordMap`

The inverted dictionary. Maps a `normalizedToken` to:

- `lemma`
- `root`

This `WordMap` enables immediate O(1) checks during the Lemma & Root scoring phases. Preloading this structure allows the `search` engine to function in completely detached client-side or server-side instances out of the box.

---

By retaining stateless functional design, `quran-search-engine` allows you to manage where these dataset arrays reside, be it `indexedDB` browserside or cached API wrappers serverside.
