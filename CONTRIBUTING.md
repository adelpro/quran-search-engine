# Contributing to quran-search-engine

First off, thank you for considering contributing to `quran-search-engine`! It's people like you that make the open-source community such a great place.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Help?

- **Reporting Bugs:** Use the bug report template to help us identify and fix issues.
- **Suggesting Features:** Have an idea? We'd love to hear it!
- **Improving Documentation:** Documentation is just as important as code.
- **Submitting Pull Requests:** Check out the issues labeled `good first issue` to get started.

## Branching Strategy

Contributors MUST create branches from `develop`.

Example:
```bash
git checkout develop
git pull origin develop
git checkout -b docs/improve-contributing-guidelines
```

Naming conventions:
- `feat/`
- `fix/`
- `docs/`
- `refactor/`

Examples:
- `feat/add-diacritics-toggle`
- `fix/normalization-edge-case`
- `docs/update-readme`

## Commit Message Guidelines

Conventional Commits style is recommended.

Examples:
- `feat(search): add diacritics toggle`
- `fix(normalization): handle hamza edge case`
- `docs: update contributing guidelines`

## Development Setup

This project uses **pnpm** for package management.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/adelpro/quran-search-engine.git
   cd quran-search-engine
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Build the library:**

   ```bash
   pnpm build
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

## Running Examples Locally

To install dependencies:
```bash
pnpm install
```

To run example apps from the `examples/` folder:
```bash
pnpm --filter <package-name> dev
```

## Testing Guidelines

- Run all tests: `pnpm test`
- During development, you can run tests to verify your code behaves correctly.
- Tests are typically located alongside the source code or in a dedicated tests directory.
- We encourage adding tests for new features or bug fixes.

## Project Structure

- `src/core`: Main search logic and tokenization.
- `src/utils`: Normalization, highlighting, and data loading.
- `src/data`: Bundled Quranic datasets (morphology, word maps).
- `examples/`: Demonstration apps (Vite/React, Node.js, Vanilla TS).

## CHANGELOG Update Process

Contributors must update `CHANGELOG.md` under `[Unreleased]`.

Example formatting:
```markdown
### Added
- Description

### Fixed
- Description
```

## Code Quality & Pre-PR Checklist

Before submitting a PR, contributors must:
- Branch from develop
- Run:
  ```bash
  pnpm lint
  pnpm build
  pnpm format
  pnpm test
  ```
- Ensure all tests pass
- Review code manually
- Submit your PR with a clear description of the problem solved (linting will run automatically via husky).

## Responsible Use of AI

AI tools may assist development. However, contributors are fully responsible for understanding and reviewing submitted code. Code must not be blindly generated and submitted.

## Questions?

Feel free to open a [Discussion](https://github.com/adelpro/quran-search-engine/discussions) or reach out via email.
