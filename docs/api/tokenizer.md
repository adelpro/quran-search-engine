# Tokenizer & Matching Logic Reference

The `search` engine logic evaluates tokens across four distinct matching layers to derive a unified score. The highest matching layer determines the final matchType of a verse.

## 1. Tokenization Phase

When a user inputs a query text, it undergoes the following cleaning phase:

- Normalization (removing unnecessary diacritics/tashkeel using `normalizeArabic` and `removeTashkeel`).
- Tokenization (splitting by whitespace into an array of distinct query terms).

The query operates using **AND logic**, meaning every token in the query array must be matched against a verse (either exactly, via its lemma, its root, or failing that, falling back to a fuzzy match).

---

## 2. Match Types & Scoring Layers

Depending on the `SearchOptions` provided to the `search` function, individual query tokens are checked layer by layer against the verse structure.

| Match Type | Value                       | Score Awarded |
| ---------- | --------------------------- | ------------- |
| Exact      | Base exact string match     | `+3`          |
| Lemma      | Morphological Lemma match   | `+2`          |
| Root       | Canonical Root match        | `+1`          |
| Semantic   | Matching via LLM Embeddings | `+0.8`        |
| Fuzzy      | Fallback index string match | `+0.5`        |
| Range      | Direct Chapter:Verse lookup | `+1.0`        |
| Regex      | Native RegExp matches       | N/A           |

### Exact Match (+3 points)

Returns a match if the verbatim normalized token is found contiguous inside the normalized verse `.standard` text field.

### Lemma Match (+2 points)

Leverages the `morphologyMap` and `wordMap` dictionary. If the original query token represents a word that shares the exact same "lemma" (dictionary headword) as a word inside the verse, it scores as a lemma match.

### Root Match (+1 point)

Similar to Lemma matching, but broader. Both words only need to originate from the same Arabic root (e.g. 3-consonant base structure).

### Fuzzy Fallback (+0.5 points)

This works by checking string proximity and similarities (using backend library like fuse.js) if no exact, lemma, or root matches are located.

---

## 3. Highlighting Mechanics

Once a query run completes, the `search` API returns the array `matchedTokens`. Deduplicating these valid matched token strings across match types allows the UI `getHighlightRanges` function to accurately compute where to apply foreground UI styling to search highlights.
