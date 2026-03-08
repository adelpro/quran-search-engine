# Architecture

The structure of `quran-search-engine` intentionally sidesteps traditional database-heavy approaches to text searching for smaller bound datasets (like the Quran). Most Quran apps bind logic to server queries.

## Folder Structure (v0.2.0)

```text
src/
├── core/
│   ├── search.ts            ← Orchestrator: single public entry point
│   ├── search.test.ts       ← Integration tests for the orchestrator
│   └── layers/              ← One file per search strategy
│       ├── simple-search.ts
│       ├── simple-search.test.ts
│       ├── fuse-search.ts
│       ├── fuse-search.test.ts
│       ├── linguistic-search.ts
│       ├── regex-search.ts
│       ├── regex-search.test.ts
│       ├── semantic-search.ts
│       └── phonetic-search.ts
├── utils/                   ← Generic, reusable helpers
│   ├── tokenization.ts      ← Token → word matching (used for highlighting)
│   ├── lru-cache.ts         ← Generic LRU cache
│   ├── range-parser.ts      ← Parse sura:aya range queries
│   ├── normalization.ts
│   ├── phonetic.ts          ← Phonetic map builder
│   ├── loader.ts
│   └── ...
├── errors/
├── types/
└── index.ts
```

## Design Principles

### 1. UI-Agnostic Core

By strictly returning `HighlightRanges` and match offsets instead of raw HTML string manipulations (like injecting `<b>` tags), `quran-search-engine` pushes the actual responsibility of display to the framework.

- Next.js can map this to Server Components seamlessly.
- React-Native can map this to styled `<Text>` chunks natively without web view overhead.
- Terminals can inject Chalk color parsing over specific indices.

### 2. Stateless Design

Instead of spinning up instances (`new SearchEngine()`), providing data, waiting for init cycles, etc., the engine utilizes pure functional exports. `search(...)` generates the exact same output given the exact same parameters endlessly, meaning:

- You control exactly when to load datasets.
- Result datasets are immediately JSON cacheable by REST layers.
- It is fully deterministic.

### 3. Layered Search Pipeline

The `search()` orchestrator routes each query through a strict priority cascade. Each layer is an isolated, independently testable module in `core/layers/`:

1. **Range layer** — Verse-coordinate queries (`2:255`, `1:1-7`) short-circuit all linguistic processing.
2. **Regex layer** — Pattern queries (when `isRegex: true`) run in isolation; linguistic layers are skipped.
3. **Simple layer** — Exact token matching in normalized Arabic text.
4. **Linguistic layer** — Lemma and root matching via morphology data.
5. **Fuse layer** — Fuzzy fallback (Fuse.js) for tokens that produced no matches above.
6. **Semantic layer** — Concept expansion (when `semantic: true`).
7. **Phonetic layer** — Latin→Arabic transliteration for non-Arabic queries.

### 4. Modular Scale

The engine gracefully degrades matching tiers. If you don't load the Morphological `MorphologyAya` Maps into memory to save space in a restrictive browser view, the engine simply skips root/lemma checking natively and falls back to string token and fuzzy matching alone.

### 5. Custom Data Integration

The library natively supports substituting the core Arabic Quran files with any custom matching JSON array you provide. By adhering to the `VerseInput` interface, it is possible to load custom datasets entirely:

- Alternate Quran narrations and texts.
- Custom terminology or word lists for specific search domains.
- Private morphological maps (`MorphologyAya`) tailored to different dictionaries.

The exported `validateQuranData`, `validateMorphologyData`, and `validateWordMapData` functions ensure your custom datasets validate cleanly against the schema before attempting to perform operations.
