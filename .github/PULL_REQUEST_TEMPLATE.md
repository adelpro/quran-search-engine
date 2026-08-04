# Pull Request

<!--
Thanks for the PR. This checklist mirrors CONTRIBUTING.md > Pre-PR quality gate.
Fill in the placeholders; delete sections that do not apply.
-->

## Summary

<!-- One or two sentences. What does this PR change and why? -->

## Linked issues

<!-- Fixes #123, or Refs #123, or "none". Delete this comment. -->

## Branch

- [ ] Branched from `develop` (the default base)
- [ ] No merge commits; rebased onto current `develop` HEAD

## Pre-PR quality gate (run in order; all must pass)

- [ ] `yarn lint` — exits 0, no warnings
- [ ] `yarn lint:md` — markdownlint clean
- [ ] `yarn build` — tsup produces `dist/`
- [ ] `yarn test` — vitest green
- [ ] `yarn size-limit` — `dist/index.mjs` under 2 MB (if bundle changed)

## AI-assisted code

- [ ] I built and tested the change locally before pushing
- [ ] I re-read the diff and removed dead or speculative code
- [ ] I added or updated tests for every behavior change
- [ ] I can explain every line I am submitting

## User-visible changes

<!-- Delete this section if not applicable. -->

- [ ] Screenshots or short clip attached for any UI change (playground examples included)
- [ ] `CHANGELOG.md` updated under `[Unreleased]` using Keep-a-Changelog categories

## Docs

- [ ] Updated the relevant guide in `docs/` (or noted why no doc change is needed)

## Checklist

- [ ] One logical change in this PR
- [ ] Commit messages follow Conventional Commits (enforced via commitlint)
- [ ] PR title is a complete Conventional Commit subject (≤ 72 chars)
