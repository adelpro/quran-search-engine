# React + TypeScript + Vite

A full-featured React example for `quran-search-engine` v0.4.0 with real-time search, pagination,
and highlighting.

## Features

- Exact, lemma, root, fuzzy, semantic, subject, range, and regex search
- Range-scoped text search (`1:1-4 العالمين`) and range/filter intersection
- Boolean queries with `+term`, `-term`, and `term | term`
- Multi-term search with a `rankBy` selector (`score`, `coverage`, `frequency`)
- Web Worker search through `createSearchWorker()` and `runSearchMany()`
- Sura ID, Juz ID, and sura-name filters
- Per-layer counts including `counts.subject`
- Highlighted matched tokens via `getHighlightRanges()`
- LRU cache for repeated queries

## Getting Started

```bash
# From the repository root: install dependencies and build the library
yarn playground:setup

# Start this example
yarn playground:react
```

Open `http://localhost:5173`.

## Production build

```bash
cd examples/vite-react
npx tsc -b && npx vite build
npx vite preview
```

## Notes

- The worker is imported with Vite's `?url` suffix and passed to `createSearchWorker()`.
- The bundled worker entry is self-contained (no bare imports), so it also works when served as a
  static asset.
- Typing two or more whitespace-separated words switches to the `search(string[])` overload.
