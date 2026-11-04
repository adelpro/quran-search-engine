# Example Applications

For practical insight into real-world stateless implementation, `quran-search-engine` ships with a suite of complete
apps demonstrating various runtimes and frameworks under the root `examples/` directory of the repository.

All examples target the current **v0.4.0** API: `loadSubjectData()`, `counts.subject`, multi-term search
(`search(string[])` / `runSearchMany()`), subject filters, and the five-argument
`buildInvertedIndex(..., subjectMap, wordMap)`.

## Quick Start

Use the convenience scripts to run examples:

```bash
# Setup: install dependencies and build the library
yarn playground:setup

# Run examples
yarn playground:react     # React + Vite
yarn playground:vanilla   # Vanilla TypeScript
yarn playground:angular   # Angular
yarn playground:node      # Node.js CLI
```

## Important Note for Local Development

Because the project utilizes `yarn workspace` linking (`workspace:*`), you must first build the core library out of
`/src` before any example application will detect your latest changes properly.

```bash
# Build the core library once
yarn build

# Or rebuild on save iteratively
yarn build --watch
```

The worker entry (`quran-search-engine/worker`) is built as a standalone, self-contained script, so it can be copied
or loaded directly by URL. The Angular example copies it with an `angular.json` asset glob and creates the client with
`new URL('search-worker.mjs', document.baseURI)`.

## Included Example Projects

| Application Type | Path                  | Run Command               | Description                                                                   |
| ---------------- | --------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| React + Vite     | `examples/vite-react` | `yarn playground:react`   | Full search UI with highlighting, pagination, worker, subject and multi-term. |
| Vanilla TS       | `examples/vanilla-ts` | `yarn playground:vanilla` | Framework-free UI with worker, subject and multi-term search.                 |
| Angular          | `examples/angular`    | `yarn playground:angular` | Standalone Angular component with worker, subject and multi-term search.      |
| NodeJS CLI       | `examples/nodejs`     | `yarn playground:node`    | Server-side usage and command-line output.                                    |

### Feature coverage

| Feature                             | React | Vanilla | Angular | Node |
| ----------------------------------- | :---: | :-----: | :-----: | :--: |
| Exact / lemma / root / fuzzy        |  ✅   |   ✅    |   ✅    |  ✅  |
| Semantic search                     |  ✅   |   ✅    |   ✅    |  ✅  |
| Subject (thematic) search           |  ✅   |   ✅    |   ✅    |  ✅  |
| Multi-term search + `rankBy`        |  ✅   |   ✅    |   ✅    |  ✅  |
| Range-scoped text + filter overlap  |  ✅   |   ✅    |   ✅    |  ✅  |
| Boolean operators (`+`, `-`, OR)    |  ✅   |   ✅    |   ✅    |  ✅  |
| Sura / Juz / sura-name filters      |  ✅   |   ✅    |   ✅    |  ✅  |
| Web Worker (`createSearchWorker`)   |  ✅   |   ✅    |   ✅    |  —   |
| Highlighting (`getHighlightRanges`) |  ✅   |   ✅    |   ✅    |  ✅  |
| Regex search                        |  ✅   |   ✅    |   ✅    |  ✅  |
| LRU cache / pre-built index         |  ✅   |   ✅    |   ✅    |  ✅  |

## End-to-end Checks

The examples are covered by a real browser test using Puppeteer. It starts the three dev servers
when they are not already running, exercises exact, multi-term, subject, range-scoped, and boolean
search in each app, verifies range/filter intersection and that the worker (not the fallback) is
active, and fails on page errors.

```bash
# Build the library first
yarn build

# Run the example E2E checks (starts the dev servers itself)
yarn test:e2e:examples
```

To test production bundles instead, serve the built examples and pass their URLs:

```bash
VANILLA_URL=http://localhost:5273/ \
REACT_URL=http://localhost:5274/ \
ANGULAR_URL=http://localhost:4300/ \
E2E_USE_EXISTING=1 yarn test:e2e:examples
```

The script exits non-zero if any check fails.
