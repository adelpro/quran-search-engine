# Vanilla TypeScript Example

A framework-free TypeScript example demonstrating the v0.4.0 `quran-search-engine` API in the browser.

## Features

- Exact, lemma, root, fuzzy, semantic, subject, range, and regex search
- Range-scoped text search (`1:1-4 العالمين`) and range/filter intersection
- Boolean queries with `+term`, `-term`, and `term | term`
- Multi-term search: 2+ words are searched independently and merged by verse `gid`, with a `rankBy`
  selector (`score`, `coverage`, `frequency`)
- Web Worker search via `createSearchWorker()` with automatic main-thread fallback
- Sura ID, Juz ID, and sura-name filters
- Highlighted results using `getHighlightRanges()`
- Live index statistics and an LRU cache

## Getting Started

1. Install dependencies and build the library:

   ```bash
   yarn playground:setup
   ```

2. Start the development server:

   ```bash
   yarn playground:vanilla
   ```

3. Open your browser and navigate to `http://localhost:5173`

## Production build

```bash
cd examples/vanilla-ts
npx tsc && npx vite build
npx vite preview
```

## Usage

- Enter Arabic text in the search box; two or more words switch to multi-term mode.
- Toggle search options (Lemma, Root, Fuzzy, Semantic, Subject, Regex) as needed.
- Use the Sura ID, Juz ID, and Sura name fields to scope results.
- The badge above the search box reports whether the worker or the main thread is running the query.
