# Search Configuration

The main `search` function accepts two optional configuration layers allowing fine-tuned control over behavior and pagination limits.

## `SearchOptions`

Toggles linguistic matching logic. Enabling Lemma & Root requires you to pass valid `morphologyMap` and `wordMap` payloads.

```typescript
export type SearchOptions = {
  // Required mapping variables
  lemma: boolean;
  root: boolean;

  // Optional variables
  fuzzy?: boolean; // Default: true
};
```

- **Fuzzy Matching:** By default `fuzzy` is allowed to fallback if exact/lemma/root checks fail. Pass `{ fuzzy: false }` to strictly enforce absolute dict matches.

## `PaginationOptions`

Control bounds limit constraints natively. Omitting these defaults to logical page limits (typically page 1, limit 50).

```typescript
export type PaginationOptions = {
  page?: number; // Starting return page.
  limit?: number; // Count return offset per page limit.
};
```
