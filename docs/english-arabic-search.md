# English to Arabic Translation Search

## Overview

This feature adds the ability to search the Quran using English words (and their synonyms), which are translated to Arabic roots for searching. The implementation leverages the library's existing root search capability.

## Data Structure

```typescript
interface EnglishArabicConcept {
  english: string[];  // All English variants (synonyms) in one field
  arabic: string[];   // Arabic roots only - library handles the rest
}
```

### Example

```json
{
  "english": ["truth", "verity", "trueness", "accuracy"],
  "arabic": ["حق", "صدق"]
}
```

### Why This Structure Works

1. **Reduced Data Complexity** - Group all English synonyms in one field instead of duplicating entries
2. **Leverage Existing Features** - Store only roots in `arabic` field; the library's built-in root search automatically finds all derived words
3. **Consistent with Phonetic Flow** - English translation lookup runs at the same point as phonetic, creating a unified non-Arabic query pipeline

## How It Works

### Query Processing Flow

```
User Query: "truth verity"
    ↓
Split into tokens: ["truth", "verity"]
    ↓
For each token:
    ↓
┌─────────────────────────────────────┐
│  isArabic(token)?                   │
├──────────────┬──────────────────────┤
│   YES        │       NO             │
│   ↓          │       ↓              │
│  Pass        │  1. English→Arabic   │
│  through     │     (NEW)            │
│  unchanged   │  2. Phonetic         │
│              │     (existing)       │
└──────────────┴──────────────────────┘
    ↓
If English found in translation map:
  "truth" → ["حق", "صدق"]
  "verity" → ["حق", "صدق"]
    ↓
Dedupe and combine: ["حق", "صدق"]
    ↓
Run search with root:true enabled
Library automatically finds:
  - "الحق", "بالحق", "حقا" (from root "حق")
  - "صدق", "صدقا", "بالصدق" (from root "صدق")
```

## Implementation Details

### Integration Point

The English→Arabic translation is integrated at [search.ts#L158](file:///src/core/search.ts#L158), right before the existing phonetic lookup:

```typescript
if (!isArabic(token)) {
  const cleanToken = token.toLowerCase().trim();

  // 1. English → Arabic translation (NEW)
  let arabicRoots = englishArabicMap.get(cleanToken);
  if (arabicRoots) {
    return arabicRoots[0]; // Use roots, library handles rest
  }

  // 2. Phonetic fallback (EXISTING)
  let arabicPossibilities = phoneticMap.get(cleanToken);
  // ...
}
```

### When Does Translation Run?

The English translation lookup **only runs when the query is NOT Arabic**:

```typescript
if (token && !isArabic(token)) {
  // Translation or Phonetic lookup happens here
}
```

This means:
- Arabic queries → Direct search (no translation)
- English/Latin queries → English translation lookup first, then phonetic fallback

## Usage

```typescript
import { search } from 'quran-search-engine';

// Search using English word
const result = search('truth', quranData, morphologyMap, wordMap, {
  lemma: true,
  root: true,  // Important: enables root-based search
  semantic: true
});

// The library will:
// 1. Look up "truth" in English→Arabic map
// 2. Find roots ["حق", "صدق"]
// 3. Search for all words derived from these roots
// 4. Return matching verses
```

## Comparison: Phonetic vs English Translation

| Feature | Phonetic | English Translation |
|---------|----------|---------------------|
| Input | Latin letters mimicking Arabic pronunciation | English words |
| Example | "bismillah" → "بسم الله" | "truth" → ["حق", "صدق"] |
| Type | Transliteration (sound-based) | Translation (meaning-based) |
| Data | Pre-computed phonetic mappings | English synonyms → Arabic roots |

## Future Enhancements

- Add `category` field for filtering semantic groups
- Support for English phrase mappings
- Integration with existing semantic search for concept expansion
