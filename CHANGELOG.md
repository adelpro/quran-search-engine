# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Range Search**: Queries like `2:255`, `1:1-7`, or `2:` now return verses directly by sura/aya coordinates, bypassing the linguistic search pipeline
- **Semantic Search**: Concept-based mapping that links Arabic synonyms and English concepts to their relevant verses.
- **New exports**: `parseRangeQuery()` and `filterVersesByRange()` utilities for consumers to detect and handle range queries
- **New type**: `ParsedRange` type for structured range query representation

- **New match type**: `'range'` added to `MatchType` union and `SearchCounts` for clean separation from linguistic results
- **CI**: Added GitHub Actions workflow to automatically run tests, linting, and build on PRs (main, develop, staging)
- **Error Handling System**: Implemented comprehensive hierarchical error handling architecture with 15 domain-specific error classes organized into 4 categories:
  - **DataLoadError**: File loading and schema validation errors (`DataFileNotFoundError`, `DataParseError`, `DataSchemaInvalidError`) - **fully integrated**
  - **SearchError**: Query and search operation errors (`InvalidQueryError`, `MissingDependenciesError`, `SearchOperationFailedError`) - infrastructure-only
  - **ValidationError**: Input validation errors (`InvalidPaginationError`, `InvalidOptionsError`, `InvalidVerseStructureError`) - infrastructure-only
  - **TokenizationError**: Text processing errors (`MissingMorphologyError`, `InvalidModeError`, `MissingWordMapError`) - infrastructure-only
- **Error Codes**: Added type-safe error code enums with 12 structured error codes across all categories
- **Error Documentation**: Added comprehensive error handling documentation in `src/errors/README.md` with architecture details, usage examples, and best practices
- **Schema Validation**: Implemented data schema validation for all loader functions (`loadMorphology`, `loadWordMap`, `loadQuranData`)
- **Loader Tests**: Added comprehensive error handling tests for loader functions covering corrupted JSON files, malformed entries, missing files, and concurrent loading scenarios
- **Error Tests**: Added 20 error-specific unit tests covering all error classes with full test coverage
- **Documentation**: Updated main `README.md` with Error Handling section including basic usage examples, error codes, and link to detailed documentation
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
