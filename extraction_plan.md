# Quranic Search Engine Extraction Plan

This document outlines the professional plan to extract the advanced searching capabilities of Open Mushaf Native into a standalone, reusable library.

## 1. Naming & Branding

**Proposed Name:** `quran-search-engine`
**Scopes (Optional):** `@open-mushaf/search-engine` if you plan to have multiple packages.

**Reasoning:**
- **Professional:** clearly describes the functionality.
- **Agnostic:** independent of the "Open Mushaf" app brand, making it attractive for other developers.
- **Searchable:** "Quran" and "Search" are high-value keywords.

## 2. Library Architecture

### Structure
We will structure this as a modern, framework-agnostic TypeScript library.

```
quran-search-engine/
├── src/
│   ├── index.ts          # Main entry point (exports everything)
│   ├── core/
│   │   ├── search.ts     # Core search logic (Fuse.js wrapper, scoring)
│   │   ├── scoring.ts    # Scoring algorithm (extracted from useQuranSearch)
│   │   ├── tokenization.ts # Token matching logic (extracted from useQuranSearch)
│   ├── utils/
│   │   ├── normalization.ts # Arabic string normalization
│   ├── types/
│   │   ├── index.ts      # Type definitions (QuranText, Morphology, etc.)
│   ├── data/
│   │   ├── index.ts      # Data loaders
├── data/                 # Raw JSON assets (kept separate)
│   ├── quran-morphology.json
│   ├── word-map.json
├── package.json
├── tsconfig.json
├── tsup.config.ts        # Bundler configuration
└── README.md
```

### Dependencies
- **Runtime:** `fuse.js` (Core engine)
- **Peer Dependencies:** None (Removed React)
- **Dev Dependencies:** `typescript`, `tsup`, `vitest`, `release-it`

## 3. Extraction Strategy

### Phase 1: Isolation & Conversion to Pure Logic
1.  **Identify Logic:**
    - `utils/searchUtils.ts` -> `src/core/search.ts`
    - `utils/arabicUtils.ts` -> `src/utils/normalization.ts`
    - **Refactor Hook Logic:** Extract `getPositiveTokens`, `computeScore`, and `processSearchResults` from `hooks/useQuranSearch.ts` into pure functions in `src/core/scoring.ts` and `src/core/tokenization.ts`.
2.  **Type Extraction:**
    - Extract `QuranText`, `MorphologyAya`, and `WordMap` interfaces into `src/types/index.ts`.

### Phase 2: Asset Management
The morphology data (~3.5MB) is significant.
- **Strategy:** Include the JSON files in the package but **do not import them by default** in the main entry point to preserve tree-shaking.
- **Implementation:**
  - Provide a `loadDefaultMorphology()` function that async imports the JSONs.
  - Allow the user to inject their own data if they have it loaded elsewhere.

### Phase 3: Consumer Integration
- **Framework Agnostic:** The library will return primitive data (results array, match scores) rather than a React Hook.
- **Example Usage (React):**
    ```typescript
    // In the app
    import { search, loadMorphology } from 'quran-search-engine';

    function useSearch(query) {
       // App implements its own state wrapping the pure library functions
       const results = useMemo(() => search(query), [query]);
       return results;
    }
    ```

## 4. Build & Testing

### Build System
Use **tsup** (built on top of esbuild) for zero-config, fast TypeScript bundling.
- **Outputs:** ESM (Modern) and CJS (Legacy compatibility).
- **Declaration Files:** `.d.ts` automatic generation.

### Testing
Use **Vitest** for unit testing.
- Test `normalizeArabic` for edge cases (tashkeel, symbols).
- Test `simpleSearch` and `advancedLinguisticSearch` with mock data.
- Ensure the extraction didn't break logic.

## 5. Publication Workflow

### Preparation
1.  **package.json setup:**
    - `main`: `./dist/index.js`
    - `module`: `./dist/index.mjs`
    - `types`: `./dist/index.d.ts`
    - `files`: [`dist`, `data`] (Whitelist files to publish)
    - `sideEffects`: false (Enable tree-shaking)

### CI/CD
1.  **GitHub Action:** Automate testing on PRs.
2.  **Versioning:** Use `semantic-release` or changesets to automate version bumping based on commit messages.

### Publishing to NPM
1.  Create an NPM organization (if using `@open-mushaf`).
2.  Login: `npm login`
3.  Publish: `npm publish --access public`
