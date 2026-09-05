import type Fuse from 'fuse.js';
import type { LRUCache } from '../../utils/lru-cache';
import { InvalidPaginationError } from '../../errors';
import { buildSearchCounts } from '../../utils/search-counts';
import type {
  AdvancedSearchOptions,
  MergedSearchResult,
  MultiTermOptions,
  MultiTermResponse,
  PaginationOptions,
  SearchContext,
  SearchCounts,
  SearchResponse,
  VerseInput,
} from '../../types';

/**
 * Signature of `search()` from `core/search.ts`. Accepted as a parameter rather than
 * imported directly, since `search.ts` imports this layer — importing `search` back
 * here would create a circular dependency.
 */
export type SearchFn = <TVerse extends VerseInput>(
  query: string,
  context: SearchContext<TVerse>,
  options?: AdvancedSearchOptions,
  pagination?: PaginationOptions,
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
) => SearchResponse<TVerse>;

/**
 * Runs each term through `searchFn` independently (no OR-query rewriting, so
 * lemma/root/semantic matching still operates on one term at a time) and merges
 * the results by verse `gid`, accumulating `matchScore`/`totalFrequency` and
 * collecting distinct matched terms. Returns an unsorted, unpaginated array —
 * ranking and pagination are the orchestrator's job, same as every other layer.
 * @param searchFn - The `search()` function to run each term through.
 * @param terms - Independent search terms, e.g. ["muhammad", "yunus", "ibrahim"].
 * @param context - The same search context accepted by `search()`.
 * @param options - Toggles for different search modes, forwarded to each term's `search()` call.
 * @param fuseIndex - Optional pre-built fuzzy index, forwarded to each term's `search()` call.
 * @param cache - Optional LRU cache, forwarded to each term's `search()` call.
 * @returns Merged results, one per distinct matched verse `gid`.
 */
export const mergeTermSearches = <TVerse extends VerseInput>(
  searchFn: SearchFn,
  terms: string[],
  context: SearchContext<TVerse>,
  options: AdvancedSearchOptions,
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
): MergedSearchResult<TVerse>[] => {
  const merged = new Map<number, MergedSearchResult<TVerse>>();

  for (const term of terms) {
    const termResponse = searchFn(
      term,
      context,
      options,
      { page: 1, limit: Number.MAX_SAFE_INTEGER },
      fuseIndex,
      cache,
    );

    for (const verse of termResponse.results) {
      const existing = merged.get(verse.gid);

      if (existing) {
        existing.matchScore += verse.matchScore;
        existing.totalFrequency += verse.matchedTokens.length;
        if (!existing.matchedTerms.includes(term)) {
          existing.matchedTerms.push(term);
          existing.distinctTermCount += 1;
        }
      } else {
        merged.set(verse.gid, {
          ...verse,
          matchedTerms: [term],
          distinctTermCount: 1,
          totalFrequency: verse.matchedTokens.length,
        });
      }
    }
  }

  return Array.from(merged.values());
};

/**
 * Backs `search()`'s array (`string[]`) overload. Not exported from the package
 * (`src/index.ts` never re-exports it) — only `core/search.ts`'s dispatcher calls
 * it, injecting `search` itself as `searchFn` (same pattern as `mergeTermSearches`,
 * avoiding a circular import back to `search.ts`).
 *
 * Merges each term's independent search via `mergeTermSearches`, then ranks,
 * paginates, and tallies counts over the merged set.
 * @param searchFn - The `search()` function to run each term through.
 * @param terms - Independent search terms, e.g. ["muhammad", "yunus", "ibrahim"].
 * @param context - The same search context accepted by `search()`.
 * @param options - Toggles for different search modes, forwarded to each term's `search()` call.
 * @param multiTermOptions - Pagination plus a `rankBy` mode (`score` | `coverage` | `frequency`).
 * @param fuseIndex - Optional pre-built fuzzy index, forwarded to each term's `search()` call.
 * @param cache - Optional LRU cache, forwarded to each term's `search()` call.
 * @returns Paginated, merged results with metadata and match counts.
 */
export const searchManyImpl = <TVerse extends VerseInput>(
  searchFn: SearchFn,
  terms: string[],
  context: SearchContext<TVerse>,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  multiTermOptions: MultiTermOptions = {},
  fuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
): MultiTermResponse<TVerse> => {
  const page = multiTermOptions.page ?? 1;
  const limit = multiTermOptions.limit ?? 20;
  const rankBy = multiTermOptions.rankBy ?? 'score';

  if (page < 1 || !Number.isInteger(page)) {
    throw new InvalidPaginationError(page, limit);
  }
  if (limit < 1 || !Number.isInteger(limit)) {
    throw new InvalidPaginationError(page, limit);
  }

  const mergedResults = mergeTermSearches(searchFn, terms, context, options, fuseIndex, cache);

  // Rank by the requested strategy; ties fall back to matchScore for coverage/frequency.
  mergedResults.sort((a, b) => {
    switch (rankBy) {
      case 'coverage':
        return b.distinctTermCount - a.distinctTermCount || b.matchScore - a.matchScore;
      case 'frequency':
        return b.totalFrequency - a.totalFrequency || b.matchScore - a.matchScore;
      case 'score':
      default:
        return b.matchScore - a.matchScore;
    }
  });

  const offset = (page - 1) * limit;
  const results = mergedResults.slice(offset, offset + limit);
  const totalResults = mergedResults.length;
  const totalPages = Math.ceil(totalResults / limit);

  // Unlike search()'s own counts (reached only after range/regex short-circuit,
  // so those matchTypes can never appear there), mergedResults comes from N
  // independent per-term search() calls — any one of them could have taken the
  // range/regex early-return path, so those matchTypes genuinely can show up here.
  const counts: SearchCounts = buildSearchCounts(mergedResults);

  return {
    results,
    counts,
    pagination: {
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    },
  };
};
