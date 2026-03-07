import Fuse, { type IFuseOptions } from 'fuse.js';

/**
 * threshold:
 * Controls how fuzzy the search matching is.
 * 0.0 requires exact matches, while 1.0 matches almost anything.
 *
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
 */
const FUSE_DISTANCE = 100;

/**
 * minMatchCharLength:
 * The minimum number of characters a search term must have
 * before Fuse considers it for comparison against the text.
 *
 * The value 3 was chosen because words shorter than 3 characters
 * are often too common or not distinctive (e.g., "من", "ال", "في")
 * and could produce many irrelevant results.
 */
const FUSE_MIN_MATCH_CHAR_LENGTH = 3;

/**
 * Initializes a Fuse.js search instance pre-configured for Arabic text.
 * Sets default fuzzy matching parameters such as threshold, distance,
 * and extended search syntax support.
 * @template T - The type of objects in the collection.
 * @param collection - The data array (e.g., verses) to search through.
 * @param keys - The object properties to index for searching (e.g., ['standard', 'translation']).
 * @param [options] - Optional Fuse.js overrides.
 * @returns A configured Fuse search instance.
 * @example
 * const fuse = createArabicFuseSearch(verses, ['standard', 'translation']);
 * const results = fuse.search('رب');
 */
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
