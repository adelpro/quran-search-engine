# English → Arabic Search (Removed)

The dedicated English-to-Arabic translation map (`loadEnglishToArabic()` and
`quran-english-arabic-roots.json`) was **removed in v0.3.0**. It is not part of the v0.4.0
public API, and the guide that used to live here described code that no longer exists.

Use one of the supported replacements instead.

## For English concept words: subject search

`loadSubjectData()` maps English concept words and phrases to curated Arabic lemmas grouped by
theme (`"climate"`, `"worship"`, `"eternal life"`, …):

```typescript
import { loadSubjectData, buildInvertedIndex, search } from 'quran-search-engine';

const subjectMap = await loadSubjectData();
const invertedIndex = buildInvertedIndex(
  morphologyMap,
  quranData,
  semanticMap,
  subjectMap,
  wordMap,
);

const context = { quranData, morphologyMap, wordMap, semanticMap, subjectMap, invertedIndex };

const response = search('faith', context, { lemma: true, root: true, subject: true });
```

See [Subject & Multi-Word Search](./subjects-and-multiword.md) for the dataset format and the
matching rules.

## For related Arabic words: semantic search

The semantic map links Arabic words to synonyms and related concepts:

```typescript
const semanticMap = await loadSemanticData();
const context = { quranData, morphologyMap, wordMap, semanticMap, invertedIndex };

search('إنسان', context, { lemma: true, root: true, semantic: true });
```

## For Latin transliteration: phonetic search

The phonetic map still resolves Latin spellings to Arabic (for example `bismillah`). Load it
with `loadPhoneticData()` and put it in the context as `phoneticMap`:

```typescript
const phoneticMap = await loadPhoneticData();
const context = { quranData, morphologyMap, wordMap, invertedIndex, phoneticMap };

search('bismillah', context, { lemma: true, root: true });
```

## Migration note

If your code imported `loadEnglishToArabic()` or read `quran-english-arabic-roots.json`, delete
that code and choose one of the approaches above. The
[Migration Guide](../migration-guide.md) covers the rest of the upgrade path.
