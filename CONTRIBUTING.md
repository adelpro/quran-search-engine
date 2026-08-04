# Contributing to quran-search-engine

`quran-search-engine` is a stateless, UI-agnostic Quran search engine written
in pure TypeScript. This guide covers everything you need to contribute a
patch, a new search layer, or a docs fix. For user-facing docs see
[`docs/index.md`](docs/index.md).

## TL;DR

```bash
corepack enable && corepack prepare yarn@4.18.0 --activate
yarn install
yarn build
yarn test
yarn lint
```

Then open a PR against `develop` using
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

## Code of conduct

By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md). Do not file public
issues for security bugs.

## Requirements

| Tool    | Version                       | Why                                         |
| ------- | ----------------------------- | ------------------------------------------- |
| Node.js | `24.x` (matches CI)           | Runtime for build, test, lint               |
| Yarn    | `4.18.0` (Berry via Corepack) | Lockfile + scripts pinned in `package.json` |
| Git     | any recent                    | Branch workflow                             |

All other toolchain (TypeScript, tsup, vitest, eslint, prettier, husky,
commitlint, markdownlint) is installed by `yarn install` — no global
installs.

## Branch model

| Branch    | Purpose                              | Stability   |
| --------- | ------------------------------------ | ----------- |
| `develop` | Default base for new work; PR target | Integration |
| `main`    | Released versions only               | Stable      |
| `staging` | Pre-release soak                     | Reserved    |

- Branch new work from `develop` (the default base).
- Use Conventional Commits types as branch-name prefixes when they apply:
  `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `test/...`, `chore/...`.
- Examples: `feat/search-diacritics-toggle`, `fix/normalization-hamza-edge`.

## Development workflow

- TypeScript is `strict: true`; new `any` is warned by ESLint
  (`@typescript-eslint/no-explicit-any: warn`).
- Prettier: `semi: true`, `singleQuote: true`, `trailingComma: "all"`,
  `printWidth: 100`, `tabWidth: 2`, `endOfLine: "auto"`.
- Source authored as ESM (`module: "ESNext"`, `target: "ES2022"`); the build
  emits dual CJS+ESM+`.d.ts` via `tsup` — do not edit `dist/`.
- One logical change per PR — split refactors, features, and fixes.
- Husky runs `yarn lint-staged` on pre-commit (ESLint --fix + Prettier on
  staged `*.{js,jsx,ts,tsx}`) and `commitlint` on commit-msg. Bypassing
  hooks is not supported.

## Pre-PR quality gate

Run in order; all must pass before opening a PR.

1. `yarn lint` — ESLint with `--max-warnings=0`; must exit clean.
2. `yarn lint:md` — markdownlint over `**/*.md` (excludes `node_modules`,
   `.agent`).
3. `yarn build` — `tsup` bundles CJS+ESM+types into `dist/`.
4. `yarn test` — `vitest` suite (colocated with source as `*.test.ts`).
5. `yarn size-limit` — verifies `dist/index.mjs` stays under the 2 MB cap
   (CI runs this; run locally before bumping bundle-heavy deps).

Steps 1–4 run in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml); step 5 runs in
[`.github/workflows/size.-limit.yml`](.github/workflows/size.-limit.yml).
A green local run is a green CI run.

## Commit messages

Conventional Commits are **enforced** via
`@commitlint/config-conventional` (see `commitlint.config.js`) in the
`.husky/commit-msg` hook.

- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
  `test`, `build`, `ci`, `chore`, `revert`.
- Subject ≤ 72 characters; body wrapped ~100 characters.
- Scopes are optional but encouraged when a clear module applies.

```text
feat(search): add diacritics toggle
fix(normalization): handle hamza edge case
docs: clarify branch base in CONTRIBUTING
perf(worker): cache tokenizer output per query
```

## Verifying AI-generated or auto-generated code

- Build and test locally before committing — never submit code you have not
  run.
- Re-read the diff line-by-line; delete dead or speculative code.
- Run the project's own linters (`yarn lint`, `yarn lint:md`) and fix every
  warning.
- Add or update tests for every behavior change — AI-generated code without
  tests will be rejected.
- If you cannot explain why a line is there, rewrite or remove it.

You are the author of record; tooling assistance does not transfer
responsibility.

## Pull requests

- Target branch: `develop`.
- Use [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md);
  its checklist mirrors the Pre-PR quality gate above.
- Reference issues with `Fixes #123` or `Refs #123`.
- One logical change per PR — split unrelated changes.
- Attach screenshots or short clips for any user-visible UI change (the
  playground examples count).
- Update [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` using
  Keep-a-Changelog categories (`Added`, `Changed`, `Deprecated`, `Removed`,
  `Fixed`, `Security`). Do not invent new categories like `Refactored`.
- Branch from `develop`, not `main`.

## Adding a new search layer

- Read [Architecture & Design Decisions](docs/reference/architecture.md)
  before writing a layer — layers compose into `core/search.ts` and must
  implement the existing contract.
- Place the implementation in `src/core/layers/<name>.ts` and its tests in
  `src/core/layers/<name>.test.ts` (colocated, vitest).
- For tokenization or matcher contracts, see
  [Tokenizer & Matching Types](docs/reference/api/tokenizer.md); for data
  shapes see
  [Inverted Index & Data Strategy](docs/reference/api/inverted-index.md).

## Reporting bugs / requesting features

- Bugs: open an issue using
  [`.github/ISSUE_TEMPLATE/bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml).
  Include reproduction, expected vs actual, environment (Node version, OS,
  library version), and a minimal snippet.
- Features: open an issue using
  [`.github/ISSUE_TEMPLATE/feature_request.yml`](.github/ISSUE_TEMPLATE/feature_request.yml).
  Describe the use case first, then the proposed API.

## License

This project is MIT — see [`LICENSE`](LICENSE). By submitting a
contribution you agree to license it under the same MIT terms.

## Documentation

User-facing docs live under [`docs/`](docs/index.md). Update the relevant
guide rather than duplicating content here. The cross-link from
[`docs/index.md`](docs/index.md) back to this file is kept in sync.

## Questions?

- [GitHub Discussions](https://github.com/adelpro/quran-search-engine/discussions)
- `contact@adelpro.us.kg`
