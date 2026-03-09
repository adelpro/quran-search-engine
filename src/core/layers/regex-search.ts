import { validateRegex } from '../../utils/regex-validation';
import { normalizeArabic } from '../../utils/normalization';
import type { VerseInput, ScoredVerse } from '../../types';

// Re-export validateRegex so existing internal imports from './regex-search' still work
export { validateRegex };

/**
 * Runs a compiled regex against every verse in `quranData`, matching against
 * the normalized `standard` field so diacritics do not interfere.
 *
 * @param regex     - Pre-validated RegExp (from `validateRegex`).
 * @param quranData - Full verse dataset to scan.
 * @returns Scored verses where the regex matched, tagged with `matchType: 'regex'`.
 * @example
 * const re = validateRegex('^...ون$');
 * const hits = performRegexSearch(re, quranData);
 */
export const performRegexSearch = <TVerse extends VerseInput>(
  regex: RegExp,
  quranData: TVerse[],
): ScoredVerse<TVerse>[] =>
  quranData
    .filter((verse) => regex.test(normalizeArabic(verse.standard)))
    .map((verse) => ({
      ...verse,
      matchType: 'regex' as const,
      matchScore: 1,
      matchedTokens: [],
      tokenTypes: {},
    }));
