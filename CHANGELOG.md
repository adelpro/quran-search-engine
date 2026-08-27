# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **CLI**: New `quran-search-engine` command for searching the Quran from a terminal, runnable via
  `npx quran-search-engine "<query>"` or after a global install.
- **CLI output formats**: `--format json|csv|tsv` and `--output <file>` for scripting, alongside matching,
  scope, and pagination options that mirror the library's own defaults.
- **Multi-term search**: `search()` now also accepts an array of terms (`search(['محمد', 'يونس'], ...)`),
  searching each independently and merging results by `gid` with score/coverage/frequency ranking.
  The existing string-query (AND-logic) behavior is unchanged.
- **CLI multi-term search**: a single argument wrapped in `[ ... ]` (e.g.
  `quran-search-engine "[محمد, يونس]"`, ASCII or Arabic comma) now runs the array overload above,
  with a `--rank-by score|coverage|frequency` option and merged-result details (matched-term and
  hit counts) in the table and `json` output. Bare positional arguments (`quran-search-engine محمد
  رسول`) instead combine into a single query, identical to quoting them together.

## [0.3.2]

### Added

- Update keywords list in package json

## [0.3.1] - 2026-03-23

### ⚠️ BREAKING CHANGES

This release contains breaking changes. Please review the [Migration Guide](./docs/migration-guide.md) before upgrading.

### Added

- **WorkerError class**: New `WorkerError` for web worker error handling with structured error codes
- **Worker status**: Worker status badge in the Vite React example UI
- **Inverted index stats**: Display inverted index statistics in the Vite React example

### Changed

- **Semantic search optimization**: Improved semantic search logic for better performance and accuracy
- **Arrays → Maps**: Replaced array-based lookups with Map data structures for O(1) access time
- **Worker loading**: Simplified worker initialization with improved loading mechanism
- **File naming convention**: Migrated to kebab-case naming (e.g., `base.error.ts` → `base-error.ts`)
- **Examples updated**: All example applications (Vite React, Vanilla TypeScript, Node.js) have been updated to reflect API changes

### Removed

- **Phonetic search index**: Phonetic index functionality has been removed
- **English-to-Arabic index**: `english-to-arabic-builder.ts` script and related data removed
- **Data files removed**:
  - `lemma-index.json`
  - `root-index.json`
  - `word-index.json`
  - `quran-english-arabic-roots.json`
  - `colored-english-wbw-translation.json`
  - `word-level-transliteration/` directory and scripts

### Documentation

- Restructured documentation into `guides/` and `reference/` directories
- Added comprehensive migration guide
- Updated API reference documentation with new type definitions

## [0.2.0] - 2026-03-07

### Added

- **Architecture: `core/layers/` folder** — Search logic is now organized into dedicated layer files, each co-located with its own test file:
  - `core/layers/simple-search.ts` + `simple-search.test.ts`
  - `core/layers/fuse-search.ts` + `fuse-search.test.ts`
  - `core/layers/linguistic-search.ts`
  - `core/layers/regex-search.ts` + `regex-search.test.ts`
  - `core/layers/semantic-search.ts`
  - `core/layers/phonetic-search.ts` (phonetic utilities promoted to a search layer)
- **Modular test suite** — Tests are now separated by concern. `search.test.ts` covers integration of the orchestrator; each layer and utility has its own dedicated test file.
- **Regex Search**: Added optional `isRegex: true` support to `AdvancedSearchOptions` for pattern-based queries, with built-in safety validation for catastrophic backtracking.
- **Documentation**: Comprehensive JSDoc comments for core search utilities in `search.ts`, `highlight.ts` and `tokenization.ts`.
- **Phonetic Search**: Search for verses using Latin/English transliterations (e.g. "Bismillah"). Includes a fuzzy fallback mechanism (via Fuse.js) to handle typos in phonetic queries.
- **Range Search**: Queries like `2:255`, `1:1-7`, or `2:` now return verses directly by sura/aya coordinates, bypassing the linguistic search pipeline.
- **Semantic Search**: Concept-based mapping that links Arabic synonyms and English concepts to their relevant verses.
- **New exports**: `parseRangeQuery()` and `filterVersesByRange()` utilities for consumers to detect and handle range queries.
- **New type**: `ParsedRange` type for structured range query representation.
- **New match type**: `'range'` added to `MatchType` union and `SearchCounts` for clean separation from linguistic results.
- **CI**: Added GitHub Actions workflow to automatically run tests, linting, and build on PRs (main, develop, staging).
- **Error Handling for Data Loaders**: Implemented structured error handling for data loading operations:
  - **BaseError**: Foundation error class with type-safe error codes
  - **DataLoadError**: Base class for data loading errors with 3 specific error types:
    - `DataFileNotFoundError` — Missing data files
    - `DataParseError` — JSON parsing failures
    - `DataSchemaInvalidError` — Invalid data structure
  - **Error Codes**: Type-safe error code enums (`ErrorCode`, `ErrorType`)
  - **Schema Validation**: Data structure validation in all loader functions (`loadMorphology`, `loadWordMap`, `loadQuranData`)
- **Error Handling Integration**: Integrated error handling into search, validation, and tokenization operations:
  - **SearchError**: `InvalidQueryError`, `MissingDependenciesError`, `SearchOperationFailedError`
  - **ValidationError**: `InvalidPaginationError`, `InvalidOptionsError`
  - **TokenizationError**: `MissingMorphologyError`, `InvalidModeError`
- **Utility**: Added `isArabic` function in `src/utils/normalization.ts`.

### Changed

- **Architecture: `utils/` reorganization** — Generic utilities (`tokenization.ts`, `lru-cache.ts`, `range-parser.ts`) moved from `core/` to `utils/`, keeping `core/` focused on the search orchestrator and its layers.
- **TODO comment**: Added a placeholder in `search.ts` for a future English-to-Arabic translation/transliteration feature (alongside the existing phonetic lookup), serving as a reference for implementing that feature.

### Fixed

- **Search**: Fixed bug in `filterVerses` where falling back to the full dataset occurred when a filter returned no results, ensuring strict filtering behavior.
- **Search Filter Logic**: Fixed `filterVerses` function to return empty arrays when explicit filters (suraId, juzId, suraName) yield no results instead of falling back to all data.
- **Regex test**: Fixed `validateRegex` usage in tests — it expects a bare pattern string (e.g. `^الحمد`) not JS regex-literal syntax (`/^الحمد/`).

## [0.1.5]

### Added

- **Documentation**: Added a changelog badge to `README.md` linking to GitHub releases
- **CI/CD**: Added `prepublishOnly` script to `package.json` to automate builds before npm publishing
- **Distribution**: Configured package to include `CHANGELOG.md` in the published npm bundle
- **Assets**: Added assets images (png, svg) to the `assets` directory
- **Readme**: Added a logo to the top of `README.md`

### Fixed

- **Husky**: Fixed "DEPRECATED" warnings by migratng Git hooks to the simplified Husky v9 format

## [0.1.4] - 2026-01-18

### Added

- **Vanilla TypeScript Example**: Added a framework-free browser example (`examples/vanilla-ts`) demonstrating plain TypeScript implementation with DOM manipulation
- **Node.js Example**: Added a server-side command-line example (`examples/nodejs`) showing programmatic usage with detailed console output
- **Workspace Configuration**: Updated `pnpm-workspace.yaml` to include all examples in the monorepo
- **Documentation**: Updated main `README.md` to list and describe all available examples

## [0.1.2] - 2026-01-16

### Added

- **Example Application**: Added a complete React + Vite example in the `examples/vite-react/` directory demonstrating real-time search, highlighting, and pagination
- **Unit Tests**: Added comprehensive test suite using Vitest covering:
  - Tokenization (Exact, Lemma, Root matching)
  - Search logic (`simpleSearch` and `advancedSearch`)
  - Arabic normalization (`removeTashkeel`, `normalizeArabic`)
  - Data loading utilities
- **Documentation**: Updated `README.md` with detailed testing instructions and example usage

### Fixed

- Fixed edge case in `tokenization` where empty normalized queries could return false positives
- Corrected test logic in `search.test.ts` to accurately reflect token matching behavior

## [0.1.0] - 2026-01-16

### Added

- Initial release of `quran-search-engine`
- Core stateless advanced search functionality
- `simpleSearch` for fast filter-based searching
- `advancedSearch` supporting exact match, fuzzy search (Fuse.js), and linguistic match (root/lemma)
- Arabic text normalization utility `normalizeArabic`
- Data loading utility `loadMorphology`
- TypeScript definitions for `QuranText` and `SearchResult`
