# Migration Guide: Upgrading to Multi-Layered Search (v0.2.0+)

This guide helps you migrate your application from the legacy simple search to the new multi-layered search architecture in `quran-search-engine`.

## Overview of Changes

The search engine has evolved from a simple text matcher into a sophisticated, multi-layered pipeline. While we've maintained broad backward compatibility, the internal logic and available options have expanded significantly.

### New Features

- **Boolean Search**: Logic operators (`AND`, `OR`, `NOT`) and grouping `(...)`.
- **Regex Search**: Unicode-aware pattern matching with ReDoS safety.
- **Phonetic Search**: Search using Latin transliteration (e.g., "Bismillah").
- **Semantic Search**: Concept-based matching using synonym maps.
- **Improved Scoring**: Layered scoring system (+3 Exact, +2 Lemma, +1 Root, +0.8 Semantic).

---

## Breaking Changes & Adjustments

### 1. `SearchOptions` Interface

The `SearchOptions` (formerly just `AdvancedSearchOptions`) has been expanded. If you were previously passing a partial object, ensure it aligns with the new structure.

**Old (v0.1.x):**
```typescript
{
  lemma: boolean;
  root: boolean;
}
```

**New (v0.2.0+):**
```typescript
{
  lemma: boolean;
  root: boolean;
  fuzzy?: boolean;
  semantic?: boolean;
  isRegex?: boolean;
  isBoolean?: boolean; // New! Defaults to false for backward compatibility
  // ... other filters like suraId, juzId
}
```

### 2. Default Search Behavior

By default, `search()` still uses simple whitespace tokenization (AND logic). To use the new **Boolean Logic Parser**, you must explicitly enable it:

```typescript
// Legacy/Default (Tokens are intersected)
const res = search('الله الرحمن', context);

// New (Boolean expressions)
const res = search('الله AND الرحمن', context, { isBoolean: true });
```

### 3. Match Types

The `matchType` field in results now includes more variants. Update your UI highlight logic if you style results based on match type.

**New types:** `regex`, `phonetic`, `semantic`.

---

## Migration Steps

### Step 1: Update Dependencies

Ensure you are using the latest version of the morphology data and word maps, as the new features rely on updated schemas.

```bash
yarn load:data # If using built-in scripts
```

### Step 2: Enable New Layers

If you want to support phonetic or semantic search, ensure you load the respective maps and pass them into the `SearchContext`.

```typescript
import { loadPhoneticMap, loadSemanticMap } from 'quran-search-engine';

const context = {
  quranData,
  morphologyMap,
  wordMap,
  phoneticMap: await loadPhoneticMap(),
  semanticMap: await loadSemanticMap(),
};
```

### Step 3: Update Highlighting

If you use `getHighlightRanges`, it now accepts an optional `tokenTypes` record from the search result to provide type-specific highlighting (e.g., different colors for exact vs. fuzzy matches).

```typescript
const ranges = getHighlightRanges(
  verse.uthmani,
  verse.matchedTokens,
  verse.tokenTypes // Pass this for better UI feedback
);
```

---

## Need Help?

If you encounter issues during migration, please [open an issue](https://github.com/adelpro/quran-search-engine/issues) or reach out to the community.
