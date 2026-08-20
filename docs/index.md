# Quran Search Engine Documentation

Welcome to the official documentation for **quran-search-engine**, a stateless, UI-agnostic Quran search engine for Arabic text written in pure TypeScript.

## Introduction

This library provides a deterministic and highly customizable search experience without being tied to any specific UI framework. You control the data, the UI rendering, and the persistence layer.

### Core Features

- Arabic Normalization (cleaning text, removing tashkeel)
- Exact text matching
- Lemma & Root matching (via morphology and word maps)
- Regular Expression search with ReDoS safety validation
- Advanced Fuzzy fallback
- Computed highlight ranges (UI-agnostic)

---

## 📚 Table of Contents

### Getting Started

- [Project Description & Getting Started](./guides/getting-started.md)
- [Installation Guide](./guides/installation.md)
- [Quick Start](./guides/quick-start.md)
- [CLI](./cli.md)

### Guides

- [Search Syntax & Scoring](./guides/search-syntax.md)
- [Advanced Configuration](./guides/configuration.md)
- [Examples & Integrations](./guides/examples.md)
- [English-Arabic Search](./guides/english-arabic-search.md)

### Reference

- [Architecture & Design Decisions](./reference/architecture.md)
- [Performance Aspects](./reference/performance.md)
- [Phonetic Inverted Index Generation](./reference/phonetic-inverted-index-generation.md)

### API Reference

- [Core API (`search`, `load...`, `normalize...`)](./reference/api/core.md)
- [Type Definitions](./reference/api/types.md)
- [Tokenizer & Matching Types](./reference/api/tokenizer.md)
- [Inverted Index & Data Strategy](./reference/api/inverted-index.md)

### Migration & Contributing

- [Migration Guide](./migration-guide.md)
- [Contribution Guide](../CONTRIBUTING.md)

---

Enjoy building fast and customizable Quran search experiences!
