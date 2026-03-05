import Fuse, { type IFuseOptions, type FuseResultMatch } from 'fuse.js';
import { LRUCache } from './lru-cache';
import { buildArabicWholeWordRegex, normalizeArabic, isArabic } from '../utils/normalization';
import { getPositiveTokens } from './tokenization';
import { parseRangeQuery, filterVersesByRange } from './range-parser';
import { semanticMap } from './semantic';
import { phoneticMap, getPhoneticFuse } from './phonetic';
import { InvalidPaginationError, MissingDependenciesError } from '../errors';
import { validateRegex, performRegexSearch } from './regex-search';
import type {
  WordMap,
  MorphologyAya,
  AdvancedSearchOptions,
  MatchType,
  SearchResponse,
  SearchCounts,
  PaginationOptions,
  VerseInput,
  ScoredVerse,
  InvertedIndex,
  WordIndex,
  RootIndex,
  LemmaIndex,
} from '../types';

type VerseWithFuseMatches<TVerse extends VerseInput> = TVerse & {
  fuseMatches?: readonly FuseResultMatch[];
};
// ==================== Fuse.js Setup ====================
/**
 * Initializes a Fuse.js search instance pre-configured for Arabic text.
 * Sets default fuzzy matching parameters such as threshold, distance,
 * and extended search syntax support.
 * @template T - The type of objects in the collection.
 * @param collection - The data array (e.g., verses) to search through.
 * @param keys - The object properties to index for searching (e.g., ['text', 'translation']).
 * @param [options] - Optional Fuse.js overrides.
 * @returns A configured Fuse search instance.
 * @example
 * const fuse = createArabicFuseSearch(verses, ['standard', 'translation']);
 * const results = fuse.search('رب');
 */
/**
 *
 *
 * threshold:
 * Controls how fuzzy the search matching is.
 * 0.0 requires exact matches, while 1.0 matches almost anything.
 *
 * And the value = 0.5 cause:
 * A value of 0.5 allows moderate typo tolerance
 * while keeping search results relevant.
 */
const FUSE_THRESHOLD = 0.5;

/**
 * distance:
 * Determines how far a matched term can be from the beginning
 * of the text and still be considered a strong result.
 *
 * A value of 100 allows matches to appear almost anywhere
 * within a verse without being penalized for their position,
 * which is suitable for Quranic verses that can vary in length.
 *
 * And the value = 100 cause:
 * It is large enough to provide flexibility,
 * but not excessively large to make the setting ineffective.
 */
const FUSE_DISTANCE = 100;

/**
 * minMatchCharLength:
 * The minimum number of characters a search term must have
 * before Fuse considers it for comparison against the text.
 *
 * If the user types a very short word, e.g., one or two letters,
 * Fuse will ignore it completely and not attempt to find it in the text.
 * This prevents random or meaningless results from being generated.
 *
 * And the value = 3 cause:
 * The value 3 was chosen because words shorter than 3 characters
 * are often too common or not distinctive (e.g., "من", "ال", "في")
 * and could produce many irrelevant results.
 * Words with 3 or more characters are usually more distinctive and important,
 * leading to more accurate and reliable search results.
 *
 */
const FUSE_MIN_MATCH_CHAR_LENGTH = 3;

export const createArabicFuseSearch = <T>(
  collection: T[],
  keys: string[],
  options: Partial<IFuseOptions<T>> = {},
): Fuse<T> =>
  new Fuse(collection, {
    includeScore: true,
    includeMatches: true,
    threshold: FUSE_THRESHOLD,
    distance: FUSE_DISTANCE,
    ignoreLocation: true,
    minMatchCharLength: FUSE_MIN_MATCH_CHAR_LENGTH,
    useExtendedSearch: true,
    keys,
    ...options,
  });

// ==================== Utilities ====================
/**
 * Filters a collection of verses based on Surah ID, Surah Name, or Juz ID.
 * * **Filter Priority:**
 * 1. `suraId` (Highest priority, strict match)
 * 2. `suraName` (Matches against Arabic, English, or Romanized names)
 * 3. `juzId` (Lowest priority, strict match)
 * * If multiple filters are provided, only the highest priority one is executed.
 * If no filters are provided, the original data is returned.
 * @param data - An array of verses to filter
 * @param suraId - Optional Surah number (1-114)
 * @param juzId - Optional Juz number (1-30)
 * @param suraName - Optional string to match against Surah names
 * @returns An array of filtered verses
 */
export const filterVerses = <TVerse extends VerseInput>(
  data: TVerse[],
  suraId?: number,
  juzId?: number,
  suraName?: string,
): TVerse[] => {
  // 1. Priority: suraId — return results even if empty (filter was explicitly requested)
  if (typeof suraId === 'number' && suraId > 0) {
    const results = data.filter((v) => v['sura_id'] === suraId);
    // Return results even if empty - user explicitly filtered by suraId
    return results;
  }

  // 2. Priority: suraName
  if (suraName) {
    const normalizedQuery = normalizeArabic(suraName).toLowerCase().trim();
    if (normalizedQuery) {
      return data.filter((verse) => {
        const normalizedSuraName = verse['sura_name']
          ? normalizeArabic(verse['sura_name'] as string)
          : '';
        const enName = ((verse['sura_name_en'] as string) || '').toLowerCase();
        const romName = ((verse['sura_name_romanization'] as string) || '').toLowerCase();
        return (
          normalizedSuraName.includes(normalizedQuery) ||
          enName.includes(normalizedQuery) ||
          romName.includes(normalizedQuery)
        );
      });
      // Logic for suraName: If we found matches by name, use them.
      // If we didn't find matches by name, should we fall through to Juz?
      // README says: "Used if suraId is invalid or missing".
      // But if suraName IS provided but no match found?
      // Strict interpretation: Strict filter. But "fuzzy" name search might imply "try to find".
      // Let's keep it strict for now to be safe, or follow the pattern.
      // Actually, for suraName, if I type "Baqara" and it matches nothing, I expect 0 results.
      // return results;
    }
  }

  // 3. Priority: juzId
  if (juzId !== undefined) {
    const results = data.filter((v) => v['juz_id'] === juzId);
    // Return results even if empty - user explicitly filtered by juzId
    return results;
  }

  // 4. Fallback: Return original data (no filter was provided)
  return data;
};
// ==================== Simple Search ====================
/**
 * Performs a high-performance search across a collection of items.
 * * Uses an inverted index (wordIndex) for O(1) lookups if available,
 * otherwise falls back to a linear scan of the specified field.
 * @param items - The collection to search through.
 * @param query - The search string.
 * @param searchField - The property name to search within (used in fallback mode).
 * @param [wordIndex] - An optional pre-computed index mapping words to Global IDs (GIDs).
 * @returns An array of items where all query tokens were found.
 * @example
 * // Fast search using an index
 * const results = simpleSearch(verses, "الحمد لله", "standard", myWordIndex);
 */
export const simpleSearch = <T extends Record<string, unknown>>(
  items: T[],
  query: string,
  searchField: keyof T,
  wordIndex?: WordIndex,
): T[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const queryTokens = cleanQuery.split(/\s+/);

  // Fast path: O(1) lookups via wordIndex
  if (wordIndex) {
    let matchingGids: Set<number> | null = null;

    for (const token of queryTokens) {
      const gids = wordIndex.get(token);
      if (!gids || gids.size === 0) return [];

      if (matchingGids === null) {
        matchingGids = new Set(gids);
      } else {
        // TODO: Replace manual intersection with Set.prototype.intersection();
        // when target is bumped to ES2025
        for (const gid of matchingGids) {
          if (!gids.has(gid)) matchingGids.delete(gid);
        }
        if (matchingGids.size === 0) return [];
      }
    }

    if (!matchingGids || matchingGids.size === 0) return [];
    return items.filter((item) => matchingGids!.has(item['gid'] as number));
  }

  // Fallback: linear scan
  return items.filter((item) => {
    const fieldValue = normalizeArabic(String(item[searchField] || ''));
    // AND logic: All tokens must be present
    return queryTokens.every((token) => fieldValue.includes(token));
  });
};

// ==================== Advanced Linguistic Search ====================

/**
 * Computes a weighted relevance score for a verse based on match types.
 * Exact Match = 3pts, Lemma Match = 2pts, Root Match = 1pt.
 * @param verse - The verse object to be scored.
 * @param cleanQuery - The normalized search query.
 * @param morphologyMap - Data map for morphological analysis.
 * @param wordMap - Data map for lemma/root lookups.
 * @param options - Advanced search settings (enable/disable lemma/root).
 * @param mapEntry - (Legacy) Deprecated mapping entry.
 * @param fuseMatches - Optional fuzzy match data from Fuse.js.
 * @returns The verse object enriched with score and match metadata.
 */
export const computeScore = <TVerse extends VerseInput>(
  verse: TVerse,
  cleanQuery: string,
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions,
  mapEntry?: { lemma?: string; root?: string }, // Deprecated/Legacy
  fuseMatches?: readonly FuseResultMatch[],
): ScoredVerse<TVerse> => {
  let score = 0;
  let matchType: MatchType = 'none';
  let matchedTokens: string[] = [];
  const tokenTypes: Record<string, MatchType> = {};

  const queryTokens = cleanQuery.split(/\s+/);

  // Check each token
  for (const token of queryTokens) {
    // 1. Text (Exact) Matches - Weight: 3
    const textMatches = getPositiveTokens(
      verse,
      'text',
      undefined,
      undefined,
      token,
      morphologyMap,
    );
    if (textMatches.length > 0) {
      score += textMatches.length * 3;
      if (matchType === 'none') matchType = 'exact'; // Upgrade only if none
      matchedTokens.push(...textMatches);
      textMatches.forEach((t) => (tokenTypes[t] = 'exact'));
    }

    // 2. Lemma/Root Matches
    const entry = wordMap[token];
    if (entry) {
      if (options.lemma && entry.lemma) {
        const lemmaMatches = getPositiveTokens(
          verse,
          'lemma',
          entry.lemma,
          undefined,
          token,
          morphologyMap,
        );
        if (lemmaMatches.length > 0) {
          score += lemmaMatches.length * 2;
          if (matchType !== 'exact') matchType = 'lemma';
          matchedTokens.push(...lemmaMatches);
          lemmaMatches.forEach((t) => {
            if (!tokenTypes[t]) tokenTypes[t] = 'lemma';
          });
        }
      }

      if (options.root && entry.root) {
        const rootMatches = getPositiveTokens(
          verse,
          'root',
          undefined,
          entry.root,
          token,
          morphologyMap,
          wordMap,
        );
        if (rootMatches.length > 0) {
          score += rootMatches.length * 1;
          if (matchType !== 'exact' && matchType !== 'lemma') matchType = 'root';
          matchedTokens.push(...rootMatches);
          rootMatches.forEach((t) => {
            if (!tokenTypes[t]) tokenTypes[t] = 'root';
          });
        }
      }
    }
  }

  // 4. Fuzzy Matches (Fallback) - Weight: 0.5 (or just purely for highlighting)
  if (matchType === 'none' && fuseMatches && fuseMatches.length > 0) {
    matchType = 'fuzzy';
    // Extract tokens from Fuse matches
    const fuzzyTokens: string[] = [];
    fuseMatches.forEach((match) => {
      const { key, indices } = match;
      if (!key || !indices) return;

      const sourceText = (verse as Record<string, unknown>)[key];
      if (typeof sourceText === 'string') {
        indices.forEach(([start, end]) => {
          // Fuse indices are inclusive [start, end]
          const token = sourceText.substring(start, end + 1);
          if (token) {
            fuzzyTokens.push(token);
            tokenTypes[token] = 'fuzzy';
          }
        });
      }
    });

    if (fuzzyTokens.length > 0) {
      matchedTokens = [...matchedTokens, ...fuzzyTokens];
      // Add some score for fuzzy matches
      score += fuzzyTokens.length * 0.5;
    }
  }

  // Deduplicate tokens
  matchedTokens = Array.from(new Set(matchedTokens));

  return { ...verse, matchScore: score, matchType, matchedTokens, tokenTypes };
};
/**
 * Executes a multi-layered linguistic search using roots, lemmas, and fuzzy matching.
 * * The search follows an "AND" logic (intersection), where all query tokens must
 * match a verse via one of the following methods (in priority order):
 * 1. Linguistic Root/Lemma lookup (via inverted index or linear scan).
 * 2. Fuzzy search (via Fuse.js) with adaptive scoring thresholds.
 * @param query - The raw search string.
 * @param quranData - The dataset to search.
 * @param options - Search configuration (toggle lemma/root/fuzzy).
 * @param fuseInstance - A pre-configured Fuse.js instance for fuzzy fallback.
 * @param wordMap - Dictionary for resolving tokens to roots/lemmas.
 * @param morphologyMap - Detailed linguistic data for every verse.
 * @param lemmaIndex - (Optional) Inverted index for fast lemma lookups.
 * @param rootIndex - (Optional) Inverted index for fast root lookups.
 * @returns Array of verses matching all tokens.
 */
export const performAdvancedLinguisticSearch = <TVerse extends VerseInput>(
  query: string,
  quranData: TVerse[],
  options: AdvancedSearchOptions,
  fuseInstance: Fuse<TVerse> | null,
  wordMap: WordMap,
  morphologyMap: Map<number, MorphologyAya>,
  lemmaIndex?: LemmaIndex,
  rootIndex?: RootIndex,
): VerseWithFuseMatches<TVerse>[] => {
  const cleanQuery = normalizeArabic(query.replace(/[^\u0600-\u06FF\s]+/g, '').trim());
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/);

  // 1. Identify which verses match EACH token
  const tokenMatches = tokens.map((token) => {
    const entry = wordMap[token];
    const matchingGids = new Set<number>();

    // Linguistic search if dictionary entry exists
    if (entry) {
      const { lemma: targetLemma, root: targetRoot } = entry;

      if (options.lemma && targetLemma) {
        if (lemmaIndex) {
          // O(1) lookup via inverted index
          const gids = lemmaIndex.get(targetLemma);
          if (gids) {
            for (const gid of gids) {
              matchingGids.add(gid);
            }
          }
        } else {
          // Fallback: linear scan (legacy path)
          const normalizedLemma = normalizeArabic(targetLemma);
          for (const verse of quranData) {
            const morph = morphologyMap.get(verse.gid);
            if (morph?.lemmas.some((lemma) => normalizeArabic(lemma).includes(normalizedLemma))) {
              matchingGids.add(verse.gid);
            }
          }
        }
      }

      if (options.root && targetRoot) {
        if (rootIndex) {
          // O(1) lookup via inverted index
          const gids = rootIndex.get(targetRoot);
          if (gids) {
            for (const gid of gids) {
              matchingGids.add(gid);
            }
          }
        } else {
          // Fallback: linear scan (legacy path)
          const normalizedRoot = normalizeArabic(targetRoot);
          for (const verse of quranData) {
            const morph = morphologyMap.get(verse.gid);
            if (morph?.roots.some((root) => normalizeArabic(root).includes(normalizedRoot))) {
              matchingGids.add(verse.gid);
            }
          }
        }
      }

      if (matchingGids.size > 0) {
        return { type: 'linguistic', gids: matchingGids };
      }
    }

    // Fallback to Fuzzy/Fuse for this token if no linguistic match
    if (options.fuzzy === false || !fuseInstance) {
      return { type: 'fuzzy', gids: new Set<number>() };
    }

    const fuseResults = fuseInstance.search(token);

    // Adaptive threshold for this token
    const hasHighQualityMatches = fuseResults.some(
      (res) => res.score !== undefined && res.score <= 0.25,
    );
    const cutoff = hasHighQualityMatches ? 0.35 : 0.5;

    const fuzzyGids = new Set<number>();
    const fuseMatchesMap = new Map<number, readonly FuseResultMatch[]>();

    fuseResults
      .filter((res) => res.score !== undefined && res.score <= cutoff)
      .forEach((res) => {
        fuzzyGids.add(res.item.gid);
        if (res.matches) fuseMatchesMap.set(res.item.gid, res.matches);
      });

    return { type: 'fuzzy', gids: fuzzyGids, fuseMatches: fuseMatchesMap };
  });

  // 2. Intersect results (AND logic)
  if (tokenMatches.length === 0) return [];

  // Start with the first set
  let intersection = new Set(tokenMatches[0].gids);

  for (let i = 1; i < tokenMatches.length; i++) {
    const currentGids = tokenMatches[i].gids;
    if (currentGids.size === 0) return []; // Short-circuit
    intersection = new Set([...intersection].filter((gid) => currentGids.has(gid)));
    if (intersection.size === 0) return [];
  }

  if (intersection.size === 0) return [];

  // 3. Map back to QuranText objects
  const gidToVerse = new Map(quranData.map((verse) => [verse.gid, verse]));

  const results: VerseWithFuseMatches<TVerse>[] = Array.from(intersection)
    .map((gid): VerseWithFuseMatches<TVerse> | null => {
      const verse = gidToVerse.get(gid);
      if (!verse) return null;

      const allFuseMatches: FuseResultMatch[] = [];

      tokenMatches.forEach((tokenMatch) => {
        if (tokenMatch.type === 'fuzzy' && tokenMatch.fuseMatches) {
          const matches = tokenMatch.fuseMatches.get(gid);
          if (matches) allFuseMatches.push(...matches);
        }
      });

      return {
        ...verse,
        fuseMatches: allFuseMatches.length > 0 ? [...allFuseMatches] : undefined,
      };
    })
    .filter((verse): verse is VerseWithFuseMatches<TVerse> => verse !== null);

  return results;
};
// ==================== Semantic Search API ====================

/**
 * Performs a semantic search across the Quran.
 * Uses the pre-built semantic map to find verses that are semantically related to the query.
 * @param cleanQuery - The normalized search query.
 * @param quranData - The dataset to search through.
 * @param options - Search configuration (must have `semantic: true` to run).
 * @returns An array of verses containing semantically related terms.
 */
const performSemanticSearch = <TVerse extends VerseInput>(
  cleanQuery: string,
  quranData: TVerse[],
  options: AdvancedSearchOptions,
): ScoredVerse<TVerse>[] => {
  const semanticMatches: ScoredVerse<TVerse>[] = [];

  if (!options.semantic || !cleanQuery) {
    return semanticMatches;
  }

  const synonyms = semanticMap.get(cleanQuery);

  if (synonyms && synonyms.length > 0) {
    for (const synonym of synonyms) {
      // use regex to match the synonym with its prefix (و، ف، ال...)
      const regex = buildArabicWholeWordRegex(synonym);

      // filter quranData directly with the regex
      const matches = quranData
        .filter((verse) => regex.test(normalizeArabic(verse.standard)))
        .map((verse) => ({
          ...verse,
          matchType: 'semantic' as const,
          matchScore: 0.8,
          matchedTokens: [synonym],
          tokenTypes: { [synonym]: 'semantic' as const },
        }));

      semanticMatches.push(...matches);
    }
  }

  return semanticMatches;
};

// ==================== Combined Search API ====================

/**
 * Performs a comprehensive search across the Quran.
 * Combines simple text search with linguistic (lemma/root) analysis and fuzzy fallback.
 * Results are scored, deduplicated, and sorted by relevance.
 * @param query - The user's input string.
 * @param quranData - The verse dataset.
 * @param morphologyMap - Morphological data for scoring.
 * @param wordMap - Dictionary for linguistic resolution.
 * @param options - Toggles for different search modes.
 * @param pagination - Page number and results per page.
 * @param preComputedFuseIndex - Optional pre-built fuzzy index.
 * @param cache - Optional LRU cache for performance.
 * @param invertedIndex - Optional Pre-built word/lemma/root indexes.
 * @returns Paginated results with metadata and match counts.
 * @example
 * result = search("الحمد لله", quranData, morphologyMap, wordMap, options, { page: 1, limit: 10 }, undefined, searchCache)
 */
export const search = <TVerse extends VerseInput>(
  query: string,
  quranData: TVerse[],
  morphologyMap: Map<number, MorphologyAya>,
  wordMap: WordMap,
  options: AdvancedSearchOptions = { lemma: true, root: true },
  pagination: PaginationOptions = { page: 1, limit: 20 },
  preComputedFuseIndex?: Fuse<TVerse>,
  cache?: LRUCache<string, SearchResponse<TVerse>>,
  invertedIndex?: InvertedIndex,
): SearchResponse<TVerse> => {
  // Validate required dependencies
  if (!quranData || !Array.isArray(quranData) || quranData.length === 0) {
    throw new MissingDependenciesError(['quranData']);
  }
  if (!morphologyMap) {
    throw new MissingDependenciesError(['morphologyMap']);
  }
  if (!wordMap) {
    throw new MissingDependenciesError(['wordMap']);
  }

  // Validate pagination parameters
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;

  if (page < 1 || !Number.isInteger(page)) {
    throw new InvalidPaginationError(page, limit);
  }
  if (limit < 1 || !Number.isInteger(limit)) {
    throw new InvalidPaginationError(page, limit);
  }

  // 0. Range query shortcut — intercept before Arabic normalization strips digits/colons
  const parsedRange = parseRangeQuery(query);
  if (parsedRange) {
    const rangeMatches = filterVersesByRange(quranData, parsedRange);
    const totalResults = rangeMatches.length;
    const totalPages = Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;

    const results: ScoredVerse<TVerse>[] = rangeMatches
      .slice(offset, offset + limit)
      .map((verse) => ({
        ...verse,
        matchScore: 1,
        matchType: 'range' as const,
        matchedTokens: [],
      }));

    return {
      results,
      counts: {
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: 0,
        range: totalResults,
        total: totalResults,
      },
      pagination: { totalResults, totalPages, currentPage: page, limit },
    };
  }

  // 0b. Regex query shortcut — isRegex:true bypasses all linguistic pipelines
  if (options.isRegex) {
    const compiledRegex = validateRegex(query); // throws InvalidRegexError on bad input
    const filtered = filterVerses(quranData, options.suraId, options.juzId, options.suraName);
    const regexMatches = performRegexSearch(compiledRegex, filtered);
    const totalResults = regexMatches.length;
    const totalPages = Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;

    return {
      results: regexMatches.slice(offset, offset + limit),
      counts: {
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: totalResults,
        range: 0,
        total: totalResults,
      },
      pagination: { totalResults, totalPages, currentPage: page, limit },
    };
  }

  // Cache lookup
  const cacheKey = cache ? JSON.stringify({ query, options, pagination }) : '';
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const fuzzyEnabled = options.fuzzy !== false;

  // 1. Prepare query
  // Tokenize and handle phonetic translation
  const tokens = query.split(/\s+/);
  const processedTokens = tokens.map((token) => {
    // If it's a phonetic (non-Arabic) word, look it up in the phonetic map
    if (token && !isArabic(token)) {
      const cleanToken = token.toLowerCase().trim();
      let arabicPossibilities = phoneticMap.get(cleanToken);

      // Fallback: Fuzzy phonetic match if exact match fails
      if (!arabicPossibilities && fuzzyEnabled) {
        const phoneticFuse = getPhoneticFuse();
        const fuzzyPhoneticMatches = phoneticFuse.search(cleanToken);
        if (fuzzyPhoneticMatches.length > 0 && (fuzzyPhoneticMatches[0].score ?? 1) < 0.3) {
          arabicPossibilities = phoneticMap.get(fuzzyPhoneticMatches[0].item);
        }
      }

      // For now, we take the first match.
      return arabicPossibilities ? arabicPossibilities[0] : '';
    }
    return token;
  });

  const translatedQuery = processedTokens.filter(Boolean).join(' ');
  const arabicOnly = translatedQuery.replace(/[^\u0621-\u064A\s]/g, '').trim();
  const cleanQuery = normalizeArabic(arabicOnly);

  if (!cleanQuery) {
    return {
      results: [],
      counts: { simple: 0, lemma: 0, root: 0, fuzzy: 0, range: 0, total: 0, semantic: 0, regex: 0 },
      pagination: {
        totalResults: 0,
        totalPages: 0,
        currentPage: page,
        limit,
      },
    };
  }

  const fuseInstance = fuzzyEnabled
    ? preComputedFuseIndex || createArabicFuseSearch(quranData, ['standard', 'uthmani'])
    : null;

  // 3. Run search layers
  const simpleMatches = simpleSearch(quranData, cleanQuery, 'standard', invertedIndex?.wordIndex);

  const advancedMatches = performAdvancedLinguisticSearch(
    cleanQuery,
    quranData,
    options,
    fuseInstance,
    wordMap,
    morphologyMap,
    invertedIndex?.lemmaIndex,
    invertedIndex?.rootIndex,
  );

  const semanticMatches = performSemanticSearch(cleanQuery, quranData, options);

  // 4. Combine and Scored Deduplication
  const allMatches = [...simpleMatches, ...advancedMatches, ...semanticMatches];
  const gidSet = new Set<number>();
  const combined: ScoredVerse<TVerse>[] = [];
  const mapEntry = wordMap[cleanQuery];

  for (const verse of allMatches) {
    if (!gidSet.has(verse.gid)) {
      gidSet.add(verse.gid);

      // If it's a semantic match (already scored), preserve it
      if ('matchType' in verse && verse['matchType'] === 'semantic') {
        combined.push(verse as ScoredVerse<TVerse>);
        continue;
      }

      // Pass fuseMatches if available
      const fuseMatches =
        'fuseMatches' in verse ? (verse as VerseWithFuseMatches<TVerse>).fuseMatches : undefined;
      combined.push(
        computeScore(verse, cleanQuery, morphologyMap, wordMap, options, mapEntry, fuseMatches),
      );
    }
  }

  // 5. Sort by relevance
  combined.sort((a, b) => b.matchScore - a.matchScore);

  // 6. Pagination & Metadata
  const offset = (page - 1) * limit;

  const results = combined.slice(offset, offset + limit);
  const totalResults = combined.length;
  const totalPages = Math.ceil(totalResults / limit);

  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: combined.filter((v) => v.matchType === 'lemma').length,
    root: combined.filter((v) => v.matchType === 'root').length,
    fuzzy: combined.filter((v) => v.matchType === 'none' || v.matchType === 'fuzzy').length,
    semantic: combined.filter((v) => v.matchType === 'semantic').length,
    regex: 0,
    range: 0,
    total: combined.length,
  };

  const response: SearchResponse<TVerse> = {
    results,
    counts,
    pagination: {
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    },
  };

  if (cache) {
    cache.set(cacheKey, response);
  }

  return response;
};
