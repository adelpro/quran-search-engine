# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-11-03

### Fixed

- **Lemma and root matches were never scored**: `computeScore()` read `wordMap[token]` even though
  `WordMap` is a `Map`, so the lookup was always `undefined`. Every verse found only through the
  lemma or root layer stayed `matchType: 'none'`, `counts.lemma`/`counts.root` were always `0`,
  and totals were inflated with unscored results (for example `العلم` reported 728 results but
  only 29 exact matches). Scoring now uses `wordMap.get(token)`; per-type counts add up to
  `counts.total` when no result is unscored (`matchType: 'none'` results count only in
  `counts.total`). Exact text matches also take priority over an earlier lemma/root match in
  multi-word queries, and lemma matches report the actual verse word (`الكتاب`) instead of the
  bare lemma (`كتب`) for highlighting.

- **`suraName` filtering for English and romanized names**: `normalizeArabic()` stripped Latin
  letters but kept the hyphen, so `suraName: 'Al-Fatiha'` collapsed to `'-'` and matched every
  romanized name containing a hyphen; English names collapsed to `''` and skipped filtering
  entirely. Arabic, English (`The Opening`), and romanized (`Al-Fatihah`) names now each match
  only their own sura. The semantic and subject layers now use the same name matcher instead of
  comparing only the Arabic `sura_name`, so their concept hits are no longer dropped when an
  English or romanized name is supplied.
- **Subject/semantic English queries and phonetic noise**: `--subject climate` and
  `search('climate', { semantic: true })` used to transliterate the English word through the
  phonetic map, injecting an unrelated Arabic term and returning thousands of unscored
  `matchType: 'none'` hits. English concept queries now skip phonetic translation, so
  `--subject climate` returns the 127 weather-theme verses and `semantic: 'climate'` returns 0
  when the semantic map has no entry.
- **Subject search precision**: subject words no longer match by bare substring. A word now
  matches a verse only when it shares the verse's root, is one of its lemmas, or appears as a
  whole token once Arabic clitics are attached (`الرياح` for `رياح`). Substring matching pulled
  `سماء` into every `ماء` search and `كتاب`/`عذاب` into every `اب` search — roughly a fifth of
  the Quran arrived in the `family` subject alone.
- **Subject index build cost**: `buildInvertedIndex` no longer re-scans all ~6.2k verses per
  subject key. It reuses the root, lemma and word indices it has already built, cutting the
  `subjectIndex` step from ~2.8s to ~0.36s on the shipped dataset.
- **Loader corrupted-JSON test**: rewrote the test to simulate corrupted data files by mocking
  the data modules instead of copying ~8.6 MB of real data (the loaders ignore file-path
  arguments by design — they use static bundler-analyzable JSON imports). The test now asserts
  `DataParseError`/`DataSchemaInvalidError` precisely and runs in milliseconds instead of
  timing out.
- **Search counts**: `counts.fuzzy` no longer includes unscored matches (`matchType: 'none'`) —
  it counts genuine fuzzy matches only, in both `search()` and multi-term search. Unscored
  matches are still reported in `counts.total`. The per-type breakdown in the CLI footer
  inherits the corrected grouping.

### Added

- **CLI**: New `quran-search-engine` command for searching the Quran from a terminal, runnable via
  `npx quran-search-engine "<query>"` or after a global install.
- **CLI output formats**: `--format json|csv|tsv` and `--output <file>` for scripting, alongside matching,
  scope, and pagination options that mirror the library's own defaults.
- **Multi-term search**: `search()` now also accepts an array of terms (`search(['محمد', 'يونس'], ...)`),
  searching each independently and merging results by `gid` with score/coverage/frequency ranking.
  The existing string-query (AND-logic) behavior is unchanged.
- **Range-scoped text search**: a range prefix followed by text (`1:1-4 العالمين`, `2:255-260 +الله`)
  now runs the normal search pipeline only over the verses in that range. Previously the text token
  made the range parser fall through, so the query searched the whole Quran.
- **Range/filter intersection**: coordinate-only ranges now intersect `suraId`, `juzId`, and
  `suraName` instead of ignoring them. `search('2:255', ctx, { suraId: 1 })` returns 0, and
  contradictory combinations return 0 rather than throwing. Filter priority is
  `suraId` > `suraName` > `juzId`.
- **CLI multi-term search**: a single argument wrapped in `[ ... ]` (e.g.
  `quran-search-engine "[محمد, يونس]"`, ASCII or Arabic comma) now runs the array overload above,
  with a `--rank-by score|coverage|frequency` option and merged-result details (matched-term and
  hit counts) in the table and `json` output. Bare positional arguments (`quran-search-engine محمد
رسول`) instead combine into a single query, identical to quoting them together.
- **Subject-based (thematic) search**: `{ subject: true }` maps an English concept word or phrase
  (`"climate"`, `"eternal life"`) to a curated set of Arabic words grouped by Islamic theme and
  searches the Quran for them. New `loadSubjectData()` export builds the map from
  `src/data/subjects.json`; pass it as `subjectMap` in the search context and, optionally, as the
  fourth argument to `buildInvertedIndex()` to get a pre-built `subjectIndex`. Matches are tagged
  `matchType: 'subject'` and tallied in `counts.subject`. The shipped dataset seeds 20 themes and
  is meant to be expanded by contributors.
- **CLI subject search**: `quran-search-engine "<query>" --subject` exposes the thematic layer from
  the terminal. Mirrors `--semantic`: off by default, ignored (with a warning) under `--regex`,
  and reported in the match breakdown footer. Subject data loads lazily, only when the flag is
  passed.
- **Subject lookup resilience**: English subject aliases fall back to a strict fuzzy match, so a
  typo such as `climte` still resolves. Arabic words are also registered as subject keys, so
  looking one up opens its whole theme instead of a plain root/lemma match.
- **Schema validators**: new `validateSubjectData()` and `validatePhoneticData()` exports, joining
  the existing dataset validators.

### Changed

- **`buildInvertedIndex`** accepts an optional fifth argument, `wordMap`. Supplying it lets each
  subject word resolve through its root, so `مطر` also covers `وأمطرنا`. The argument is optional
  and existing calls keep working; without it, subject words resolve by lemma and clitic form only.
- **`src/data/subjects.json`** entries are now written in their base form (`مطر`, not `أمطار`),
  since the shared root already covers the derived forms. 40 entries that matched no verse at all
  — `أمطار`, `عواصف`, `معركة`, `سلاح` and others that simply do not occur in the Quran — were
  replaced with attested forms of the same root or dropped, and `قوم` (`family`) and `عالم`
  (`creation`) were removed as thematic mismatches. 301 Arabic entries → 264, none of them dead.
- **`SearchCounts.subject`** is a required field, and **`MatchType`** gains a `'subject'` member.
  Code that constructs a `SearchCounts` object literal or exhaustively switches on `MatchType`
  needs updating; see the [Migration Guide](./docs/migration-guide.md).
- **Documentation**: guides, API reference, README, and the migration guide now match the v0.4.0
  API. Removed stale references to `loadInvertedIndex()` and `isBoolean`, corrected the
  `loadQuranData()` return type, documented subject and multi-term search, and fixed the boolean
  operator syntax (`+term`, `-term`, `term | term`). Boolean search is documented as supported and
  auto-detected, with verified result counts and a note that `AND`/`OR`/`NOT` are not operators
  (`OR`/`NOT` are dropped, `AND` resolves to `عند` through the phonetic map) and that
  `invertedIndex` counts differ from the linear-scan fallback.

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
- **Examples updated**: All example applications (Vite React, Vanilla TypeScript, Node.js) have been updated to reflect
  API changes

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

- **Architecture: `core/layers/` folder** — Search logic is now organized into dedicated layer files, each co-located
  with its own test file:
  - `core/layers/simple-search.ts` + `simple-search.test.ts`
  - `core/layers/fuse-search.ts` + `fuse-search.test.ts`
  - `core/layers/linguistic-search.ts`
  - `core/layers/regex-search.ts` + `regex-search.test.ts`
  - `core/layers/semantic-search.ts`
  - `core/layers/phonetic-search.ts` (phonetic utilities promoted to a search layer)
- **Modular test suite** — Tests are now separated by concern. `search.test.ts` covers integration of the orchestrator;
  each layer and utility has its own dedicated test file.
- **Regex Search**: Added optional `isRegex: true` support to `AdvancedSearchOptions` for pattern-based queries, with
  built-in safety validation for catastrophic backtracking.
- **Documentation**: Comprehensive JSDoc comments for core search utilities in `search.ts`, `highlight.ts` and `tokenization.ts`.
- **Phonetic Search**: Search for verses using Latin/English transliterations (e.g. "Bismillah"). Includes a fuzzy
  fallback mechanism (via Fuse.js) to handle typos in phonetic queries.
- **Range Search**: Queries like `2:255`, `1:1-7`, or `2:` now return verses directly by sura/aya coordinates, bypassing
  the linguistic search pipeline.
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

- **Architecture: `utils/` reorganization** — Generic utilities (`tokenization.ts`, `lru-cache.ts`, `range-parser.ts`)
  moved from `core/` to `utils/`, keeping `core/` focused on the search orchestrator and its layers.
- **TODO comment**: Added a placeholder in `search.ts` for a future English-to-Arabic translation/transliteration
  feature (alongside the existing phonetic lookup), serving as a reference for implementing that feature.

### Fixed

- **Search**: Fixed bug in `filterVerses` where falling back to the full dataset occurred when a filter returned no
  results, ensuring strict filtering behavior.
- **Search Filter Logic**: Fixed `filterVerses` function to return empty arrays when explicit filters (suraId, juzId,
  suraName) yield no results instead of falling back to all data.
- **Regex test**: Fixed `validateRegex` usage in tests — it expects a bare pattern string (e.g. `^الحمد`) not JS
  regex-literal syntax (`/^الحمد/`).

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

- **Vanilla TypeScript Example**: Added a framework-free browser example (`examples/vanilla-ts`) demonstrating plain
  TypeScript implementation with DOM manipulation
- **Node.js Example**: Added a server-side command-line example (`examples/nodejs`) showing programmatic usage with
  detailed console output
- **Workspace Configuration**: Updated `pnpm-workspace.yaml` to include all examples in the monorepo
- **Documentation**: Updated main `README.md` to list and describe all available examples

## [0.1.2] - 2026-01-16

### Added

- **Example Application**: Added a complete React + Vite example in the `examples/vite-react/` directory demonstrating
  real-time search, highlighting, and pagination
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
