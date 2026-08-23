# Inverted Index & Data Strategies

`quran-search-engine` employs sophisticated data strategies locally for lookup speed. We avoid massive memory overhead
while retaining O(1) matching via `Map` dictionaries.

## Search Concept

Instead of looping through all 6000+ verses (O(N) search times), we utilize the `wordMap` dictionary.

### Data Types

#### `QuranText`

Input dataset object defining attributes:

- `gid`: Unique Verse ID.
- `standard`: Simple exact text field for matching exact queries.
- `uthmani`: The base field commonly used for fuzzy fallbacks.

#### `MorphologyAya`

The preloaded morphology dataset. This is a `Map<number, MorphologyAya>`.
When matched, a query token uses `wordMap` to retrieve the possible `{ lemma, root }`. If a match object matches the
Morphology map via Verse `gid`, it guarantees the verse contains the intended lemma/root match string without regular
expressions.

#### `WordMap`

The standard dictionary. Maps a `normalizedToken` to:

- `lemma`
- `root`

### Advanced `InvertedIndex` Structures

To prevent scanning multiple arrays across 6,000+ entries, compiling and passing an `InvertedIndex` significantly
optimizes lookup speeds over `O(1)` Set checks bypassing String RegEx matchings.

- **`WordIndex`**: (`Map<string, Set<number>>`) Maps normalized exact text tokens directly to a Set of matching Verse `gid`s.
- **`LemmaIndex`**: (`Map<string, Set<number>>`) Maps morphological lemma strings directly to matching Verse `gid`s.
- **`RootIndex`**: (`Map<string, Set<number>>`) Maps Canonical roots directly to matching Verse `gid`s.

By preloading these structures via `loadInvertedIndex()`, the `search` engine eliminates iteration layers for simple
keyword validation logic and behaves remarkably fast in completely detached client-side or server-side boundaries.

---

By retaining stateless functional design, `quran-search-engine` allows you to manage where these dataset arrays reside,
be it `indexedDB` browserside or cached API wrappers serverside.
