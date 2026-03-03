# Search Configuration

The main `search` function accepts two optional configuration layers allowing fine-tuned control over behavior and pagination limits.

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

  // Optional geographic filtering parameters
  suraId?: number;
  juzId?: number;
  suraName?: string;
  sura_name_en?: string;
  sura_name_romanization?: string;
};

export type SearchOptions = AdvancedSearchOptions;
```

- **Fuzzy Matching:** By default `fuzzy` is allowed to fallback if exact/lemma/root checks fail. Pass `{ fuzzy: false }` to strictly enforce absolute dict matches.
- **Regex Search:** Passing `{ isRegex: true }` processes the query as a regular expression instead of standard token matching.
- **Semantic Search:** Enable `{ semantic: true }` to integrate with AI embeddings conditionally if valid data map shapes are configured.
- **Filtering Options:** Narrow searches spatially via explicit `{ suraId: 2, juzId: 3 }` etc.

## `PaginationOptions`

Control bounds limit constraints natively. Omitting these defaults to logical page limits (typically page 1, limit 50).

```typescript
export type PaginationOptions = {
  page?: number; // Starting return page.
  limit?: number; // Count return offset per page limit.
};
```
