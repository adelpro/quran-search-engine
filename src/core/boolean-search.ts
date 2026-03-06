import { computeScore, search } from './search';
import { LRUCache } from './lru-cache';
import {
  AdvancedSearchOptions,
  InvertedIndex,
  MorphologyAya,
  PaginationOptions,
  SearchCounts,
  SearchResponse,
  VerseInput,
  WordMap,
  BooleanQuery,
} from '../types';
import Fuse from 'fuse.js';

// booleanSearch.ts
function parseBooleanQuery(rawQuery: string): BooleanQuery {
  const result: BooleanQuery = { must: [], exclude: [], either: [] };

  // Split on whitespace but keep | groups together
  // e.g. "fire | water -hell +grace" → ["fire", "|", "water", "-hell", "+grace"]
  const tokens = rawQuery.trim().split(/\s+/);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '|') {
      // Skip bare pipe — handled below as part of OR group
      i++;
      continue;
    }

    if (token.startsWith('+')) {
      const term = token.slice(1).toLowerCase();
      if (term) result.must.push(term);
    } else if (token.startsWith('-')) {
      const term = token.slice(1).toLowerCase();
      if (term) result.exclude.push(term);
    } else {
      // Bare term — could be part of an OR chain
      // Look ahead: if next token is "|", collect the whole OR group
      const orGroup: string[] = [token.toLowerCase()];
      while (tokens[i + 1] === '|' && tokens[i + 2]) {
        i += 2; // skip "|" and advance to next term
        orGroup.push(tokens[i].toLowerCase());
      }
      result.either.push(...orGroup);
    }

    i++;
  }

  return result;
}

export function booleanSearch<TVerse extends VerseInput>(
  query: string,
  quranData: TVerse[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
  preComputedFuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
  invertedIndex?: InvertedIndex,
): SearchResponse<TVerse> {
  const parsed = parseBooleanQuery(query);

  // Helper: Get GIDs for a single term by delegating to search()
  const getGidsForTerm = (term: string): Set<number> => {
    const result = search(
      term,
      quranData,
      morphologyMap,
      wordMap,
      options,
      { page: 1, limit: 6500 }, // Get ALL results for this term
      preComputedFuseIndex,
      undefined, // Don't cache intermediate results
      invertedIndex,
    );
    return new Set(result.results.map((v) => v.gid));
  };

  // Cache lookup
  const cacheKey = cache ? JSON.stringify({ query, options, pagination }) : '';
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  // Start with all verses
  let resultGids = new Set<number>(quranData.map((v) => v.gid));

  // 1. Apply MUST terms (intersection)
  for (const term of parsed.must) {
    const termGids = getGidsForTerm(term);
    resultGids = new Set([...resultGids].filter((gid) => termGids.has(gid)));
    if (resultGids.size === 0) break; // Short-circuit
  }

  // 2. Apply EXCLUDE terms (difference)
  for (const term of parsed.exclude) {
    const termGids = getGidsForTerm(term);
    resultGids = new Set([...resultGids].filter((gid) => !termGids.has(gid)));
  }

  // 3. Apply EITHER terms (union, then intersection with current results)
  if (parsed.either.length > 0) {
    const eitherGids = new Set<number>();
    for (const term of parsed.either) {
      const termGids = getGidsForTerm(term);
      termGids.forEach((gid) => eitherGids.add(gid));
    }
    resultGids = new Set([...resultGids].filter((gid) => eitherGids.has(gid)));
  }

  // 4. Convert GIDs back to verses and score them
  const gidMap = new Map(quranData.map((v) => [v.gid, v]));
  const combined = Array.from(resultGids)
    .map((gid) => gidMap.get(gid))
    .filter((v): v is TVerse => v !== undefined)
    .map((verse) =>
      computeScore(
        verse,
        query.replace(/[+\-|]/g, '').trim(), // Clean query for scoring
        morphologyMap,
        wordMap,
        options,
      ),
    );

  // 5. Sort by score
  combined.sort((a, b) => b.matchScore - a.matchScore);

  // 6. Paginate
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  const offset = (page - 1) * limit;
  const results = combined.slice(offset, offset + limit);

  // 7. Build response (reuse pattern from search())
  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: combined.filter((v) => v.matchType === 'lemma').length,
    root: combined.filter((v) => v.matchType === 'root').length,
    fuzzy: combined.filter((v) => v.matchType === 'fuzzy').length,
    semantic: combined.filter((v) => v.matchType === 'semantic').length,
    range: 0,
    total: combined.length,
  };
  const response: SearchResponse<TVerse> = {
    results,
    counts,
    pagination: {
      totalResults: combined.length,
      totalPages: Math.ceil(combined.length / limit),
      currentPage: page,
      limit,
    },
  };

  if (cache) {
    cache.set(cacheKey, response);
  }

  return response;
}
