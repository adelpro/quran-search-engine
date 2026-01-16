# Task: Extract Advanced Search to Library

- [x] Create `packages/quran-search-engine` directory structure
- [x] Initialize `package.json` with appropriate name and dependencies
- [x] Configure `tsconfig.json` and `tsup.config.ts`
- [x] Extract `arabicUtils.ts` to `src/utils/normalization.ts`
- [x] Extract `searchUtils.ts` to `src/core/search.ts`
- [x] Extract scoring/tokenization logic from `useQuranSearch.ts` into pure functions (`src/core/tokenization.ts`)
- [x] Extract types from `types/index.ts` to `src/types/index.ts`
- [x] Set up handling for `quran-morphology.json` and `word-map.json`
- [x] **Configure Development Tooling**
    - [x] Update `package.json` with devDependencies
    - [x] Create `.gitignore` and `.npmignore`
    - [x] Create `.prettierrc` and `.prettierignore`
    - [x] Create `.eslintrc.js`
    - [x] Configure Husky and Commitlint
- [ ] **Create `loadMorphology` and data loading utilities**
- [ ] Add unit tests with Vitest
- [ ] Verify build output
- [ ] (Optional) Publish to NPM or link locally
