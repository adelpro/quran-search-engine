# Quran Search Engine Documentation

Welcome to the official documentation for **quran-search-engine**, a stateless, UI-agnostic Quran search engine for Arabic text written in pure TypeScript.

## Introduction

This library provides a deterministic and highly customizable search experience without being tied to any specific UI framework. You control the data, the UI rendering, and the persistence layer.

### Core Features

- Arabic Normalization (cleaning text, removing tashkeel)
- Exact text matching
- Lemma & Root matching (via morphology and word maps)
- Advanced Fuzzy fallback
- Computed highlight ranges (UI-agnostic)

---

## 📚 Table of Contents

### Getting Started

- [Project Description & Getting Started](./getting-started.md)
- [Installation Guide](./installation.md)
- [Quick Start](./quick-start.md)

### Usage & Core Concepts

- [Search Syntax & Scoring](./search-syntax.md)
- [Advanced Configuration](./configuration.md)
- [Architecture & Design Decisions](./architecture.md)
- [Performance Aspects](./performance.md)

### Examples & Integrations

- [Usage Examples](./examples.md)

### API Reference

- [Core API (`search`, `load...`, `normalize...`)](./api/core.md)
- [Tokenizer & Matching Types](./api/tokenizer.md)
- [Inverted Index & Data Strategy](./api/inverted-index.md)

### Contributing

- [Contribution Guide](./contributing.md)

---

Enjoy building fast and customizable Quran search experiences!
