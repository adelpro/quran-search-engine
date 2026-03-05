# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Regex Search**: Added optional `isRegex: true` support to `AdvancedSearchOptions` for pattern-based queries, with built-in safety validation for catastrophic backtracking.
- **Documentation**: Comprehensive JSDoc comments for core search utilities in `search.ts`, `highlight.ts` and `tokenization.ts`.
- **Phonetic Search**: Search for verses using Latin/English transliterations (e.a., "Bismillah"). Includes a fuzzy fallback mechanism (via Fuse.js) to handle typos in phonetic queries.
- **Range Search**: Queries like `2:255`, `1:1-7`, or `2:` now return verses directly by sura/aya coordinates, bypassing the linguistic search pipeline
- **Semantic Search**: Concept-based mapping that links Arabic synonyms and English concepts to their relevant verses.
- **New exports**: `parseRangeQuery()` and `filterVersesByRange()` utilities for consumers to detect and handle range queries
- **New type**: `ParsedRange` type for structured range query representation

- **New match type**: `'range'` added to `MatchType` union and `SearchCounts` for clean separation from linguistic results
- **CI**: Added GitHub Actions workflow to automatically run tests, linting, and build on PRs (main, develop, staging)
- **Error Handling for Data Loaders**: Implemented structured error handling for data loading operations:
  - **BaseError**: Foundation error class with type-safe error codes
  - **DataLoadError**: Base class for data loading errors with 3 specific error types:
    - `DataFileNotFoundError` - Missing data files
    - `DataParseError` - JSON parsing failures
    - `DataSchemaInvalidError` - Invalid data structure
  - **Error Codes**: Type-safe error code enums (`ErrorCode`, `ErrorType`)
  - **Schema Validation**: Data structure validation in all loader functions (`loadMorphology`, `loadWordMap`, `loadQuranData`)
  - **Comprehensive Tests**: Full test coverage for error classes and loader error scenarios
  - **Documentation**: Error handling guide in `src/errors/README.md`
- **Error Handling Integration**: Integrated error handling into search, validation, and tokenization operations:
  - **SearchError**: 3 error classes for search operations:
    - `InvalidQueryError` - Invalid search queries
    - `MissingDependenciesError` - Missing required dependencies (quranData, morphologyMap, wordMap)
    - `SearchOperationFailedError` - Search operation failures
  - **ValidationError**: 2 error classes for input validation:
    - `InvalidPaginationError` - Invalid pagination parameters (page/limit must be positive integers)
    - `InvalidOptionsError` - Invalid search options
  - **TokenizationError**: 2 error classes for tokenization:
    - `MissingMorphologyError` - Missing morphology data for a verse
    - `InvalidModeError` - Invalid tokenization mode (must be text, lemma, or root)
  - **Validation Integration**: Added pagination and dependency validation to `search()` function
  - **Mode Validation**: Added mode parameter validation to `getPositiveTokens()` function
  - **Error Tests**: Added 11 new integration tests to existing module test files (search.test.ts, tokenization.test.ts)
  - **Error Codes**: Added 9 new error codes bringing total to 12 structured error codes
- **Utility**: Added `isArabic` function in `src/utils/normalization.ts` that returns `true` if a string contains Arabic characters (Unicode range \u0600-\u06FF) (#3)

### Fixed

- **Search**: Fixed bug in `filterVerses` where falling back to the full dataset occurred when a filter returned no results, ensuring strict filtering behavior.
- **Search Filter Logic**: Fixed `filterVerses` function to return empty arrays when explicit filters (suraId, juzId, suraName) yield no results instead of falling back to all data


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
