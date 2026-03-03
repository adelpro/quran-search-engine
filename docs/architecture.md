# Architecture

The structure of `quran-search-engine` intentionally sidesteps traditional database-heavy approaches to text searching for smaller bound datasets (like the Quran). Most Quran apps bind logic to server queries.

### 1. UI-Agnostic Core

By strictly returning `HighlightRanges` and match offsets instead of raw HTML string manipulations (like injecting `<b>` tags), `quran-search-engine` pushes the actual responsibility of display to the framework.

- Next.js can map this to Server Components seamlessly.
- React-Native can map this to styled `<Text>` chunks natively without web view overhead.
- Terminals can inject Chalk color parsing over specific indicies.

### 2. Stateless Design

Instead of spinning up instances (`new SearchEngine()`), providing data, waiting for init cycles, etc., the engine utilizes pure functional exports. `search(...)` generates the exact same output given the exact same parameters endlessly, meaning:

- You control exactly when to load datasets.
- Result datasets are immediately JSON cacheable by REST layers.
- It is fully deterministic.

### 3. Modular Scale

The engine gracefully degrades matching tiers. If you don't load the Morphological `MorphologyAya` Maps into memory to save space in a restrictive browser view, the engine simply skips root/lemma checking natively and falls back to string token and fuzzy matching alone.

### 4. Custom Data Integration

The library natively supports substituting the core Arabic Quran files with any custom matching JSON array you provide. By adhering to the `VerseInput` interface, it is possible to load custom datasets entirely:

- Alternate Quran narrations and texts.
- Custom terminology or word lists for specific search domains.
- Private morphological maps (`MorphologyAya`) tailored to different dictionaries.
  The exported `validateQuranData`, `validateMorphologyData`, and `validateWordMapData` functions ensure your custom datasets validate cleanly against the schema before attempting to perform operations.
