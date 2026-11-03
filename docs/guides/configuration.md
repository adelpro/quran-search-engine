# Search Configuration

The main `search` function takes a required `SearchContext` plus optional `SearchOptions` and
pagination layers, giving fine-tuned control over matching behaviour and page limits.

## `SearchOptions`

Toggles linguistic matching logic. Enabling Lemma & Root requires you to pass valid `morphologyMap` and `wordMap` payloads.

```typescript
export type AdvancedSearchOptions = {
  // Required mapping variables
  lemma: boolean;
  root: boolean;

  // Optional matching variables
  fuzzy?: boolean; // Default: true
  isRegex?: boolean;
  semantic?: boolean;
  subject?: boolean;

  // Optional geographic filtering parameters
  suraId?: number;
  juzId?: number;
  suraName?: string;
  sura_name_en?: string;
  sura_name_romanization?: string;
};

export type SearchOptions = AdvancedSearchOptions;
```

- **Fuzzy Matching:** By default `fuzzy` is allowed to fallback if exact/lemma/root checks fail. Pass `{ fuzzy: false }`
  to strictly enforce absolute dict matches.
- **Regex Search:** Passing `{ isRegex: true }` processes the query as a regular expression instead of standard token
  matching. The pattern is validated for syntactic correctness and checked against known ReDoS-prone patterns (nested
  quantifiers, overlapping alternation) before execution. Throws `InvalidRegexError` for invalid or unsafe patterns.
  Regex search bypasses all linguistic pipelines (lemma, root, fuzzy) and matches directly against the normalized
  `standard` text field. Can be combined with `suraId`, `juzId`, or `suraName` to narrow the search scope.
- **Semantic Search:** Enable `{ semantic: true }` to integrate with AI embeddings conditionally if valid data map
  shapes are configured.
- **Subject Search:** Enable `{ subject: true }` to perform thematic search. Requires passing
  `subjectMap` (loaded via `loadSubjectData()`) in the search context. Maps English concept
  words (e.g. `"climate"`, `"worship"`) to curated Arabic words grouped by Islamic theme,
  then searches for those words in the Quran. A word matches a verse when it shares the
  verse's root, is one of its lemmas, or appears as a whole token once Arabic clitics are
  attached (`الرياح` for `رياح`) — never by bare substring, which would match `ماء`
  inside `سماء`. Root resolution requires `wordMap`, so pass it to `buildInvertedIndex` as
  the fifth argument. The initial `src/data/subjects.json` seed covers 20 themes and is
  designed to be expanded by contributors over time; write new entries in their base form
  (`مطر`, not `أمطار`), since the root already covers the derived forms.
- **Filtering Options:** Narrow searches spatially via explicit `{ suraId: 2, juzId: 3 }` etc.

## `PaginationOptions`

Control bounds limit constraints natively. Omitting these defaults to page `1` with `20`
results per page.

```typescript
export type PaginationOptions = {
  page?: number; // Starting return page.
  limit?: number; // Count return offset per page limit.
};
```

## `MultiTermOptions`

Used only by `search()`'s array overload. It adds `rankBy` on top of pagination:

```typescript
export type RankBy = 'score' | 'coverage' | 'frequency';

export type MultiTermOptions = PaginationOptions & {
  rankBy?: RankBy; // Default: 'score'
};
```

| `rankBy`    | Orders by                              |
| ----------- | -------------------------------------- |
| `score`     | Accumulated `matchScore` (default)     |
| `coverage`  | `distinctTermCount`, then `matchScore` |
| `frequency` | `totalFrequency`, then `matchScore`    |

## `SearchContext`

The second argument to `search()`. Only the first three fields are required:

```typescript
export type SearchContext<TVerse extends VerseInput = QuranText> = {
  quranData: Map<number, TVerse>; // required
  morphologyMap: Map<number, MorphologyAya>; // required
  wordMap: WordMap; // required
  invertedIndex?: InvertedIndex; // recommended: O(1) lemma/root/word lookups
  semanticMap?: Map<string, string[]>; // required for { semantic: true }
  subjectMap?: Map<string, string[]>; // required for { subject: true }
  phoneticMap?: Map<string, string[]>; // for Latin transliteration
};
```
