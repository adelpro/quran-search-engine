# Angular Example

A standalone Angular 18 example demonstrating `quran-search-engine` v0.4.0 with server-side
worker offloading.

## Features

- Exact, lemma, root, fuzzy, semantic, subject, range, and regex search
- Range-scoped text search (`1:1-4 العالمين`) and range/filter intersection
- Boolean queries with `+term`, `-term`, and `term | term`
- Multi-term search with a `rankBy` selector (`score`, `coverage`, `frequency`)
- Web Worker search via `createSearchWorker()` and `runSearchMany()`
- Sura ID, Juz ID, and sura-name filters
- Per-layer counts including `counts.subject`
- Highlighted results via `getHighlightRanges()`

## Getting Started

```bash
# From the repository root: install dependencies and build the library
yarn playground:setup

# Start this example
yarn playground:angular
```

Open `http://localhost:4200`.

## Worker setup

Angular's application builder cannot resolve the package's `quran-search-engine/worker` export to a
dev-server URL, so `angular.json` copies the self-contained worker bundle from
`node_modules/quran-search-engine/dist/worker` to the app root:

```json
"assets": [
  {
    "glob": "search-worker.mjs",
    "input": "node_modules/quran-search-engine/dist/worker",
    "output": "."
  }
]
```

The component then creates the client with:

```ts
createSearchWorker({
  workerUrl: new URL('search-worker.mjs', document.baseURI),
});
```

If worker creation fails, the example falls back to running searches on the main thread.

## Production build

```bash
cd examples/angular
npx ng build --configuration production
```

Serve `dist/angular/browser` with any static file server.
