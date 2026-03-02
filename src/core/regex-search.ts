import { normalizeArabic, removeTashkeel } from '../utils/normalization';
import type {
  VerseInput,
  ScoredVerse,
  SearchResponse,
  SearchCounts,
  PaginationOptions,
} from '../types';

const MAX_PATTERN_LENGTH = 1000;
const MAX_GROUP_NESTING = 5;

/**
 * Normalizes Arabic characters in a regex pattern without stripping
 * regex metacharacters. Only removes diacritics and unifies alef/hamza variants.
 */
const normalizeRegexPattern = (pattern: string): string => {
  // Remove diacritics only (preserves non-Arabic regex syntax)
  let result = removeTashkeel(pattern).normalize('NFC');

  // Unify alef variants → ا
  result = result.replace(/[إأآٱ]/g, 'ا');

  // Unify hamza variants → ء
  result = result.replace(/[ؤئء]/g, 'ء');

  // Alif maqsura → ي
  result = result.replace(/ى/g, 'ي');

  return result;
};

/**
 * Validates a regex pattern for safety and correctness.
 * Rejects patterns that could cause catastrophic backtracking,
 * are too long, or have excessive nesting.
 */
export const validateRegex = (
  pattern: string,
): { valid: true } | { valid: false; error: string } => {
  if (!pattern) return { valid: true };

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { valid: false, error: `Pattern too long (max ${MAX_PATTERN_LENGTH} characters)` };
  }

  // Check for nested quantifiers (catastrophic backtracking risk)
  // Patterns like (a+)+, (a*)+, (a+)*, (.*)*, (a+){2,20}
  if (/(\([^)]*[+*][^)]*\))[+*{]/.test(pattern)) {
    return {
      valid: false,
      error: 'Potential catastrophic backtracking: nested quantifiers detected',
    };
  }

  // Check for quantified alternation groups (alternation bombs)
  // Patterns like (a|aa)+, (x|y|z)+
  if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern)) {
    return {
      valid: false,
      error: 'Potential catastrophic backtracking: quantified alternation group detected',
    };
  }

  // Check for excessive group nesting (skip char classes and escaped parens)
  let depth = 0;
  let maxDepth = 0;
  let inClass = false;
  let escaped = false;

  for (const char of pattern) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '[' && !inClass) {
      inClass = true;
      continue;
    }
    if (char === ']' && inClass) {
      inClass = false;
      continue;
    }
    if (inClass) continue;

    if (char === '(') {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === ')') {
      depth--;
    }
  }
  if (maxDepth > MAX_GROUP_NESTING) {
    return { valid: false, error: `Excessive group nesting (max ${MAX_GROUP_NESTING} levels)` };
  }

  // Try constructing the regex to catch syntax errors
  try {
    new RegExp(pattern, 'u');
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Invalid regex: ${(e as Error).message}` };
  }
};

/**
 * Performs regex-based search across Quran verses.
 * Matches the pattern against the normalized `standard` field.
 * The pattern is diacritic-normalized (tashkeel stripped, alef/hamza unified)
 * while preserving regex metacharacters.
 * Returns matching words as matchedTokens for highlighting.
 */
export const searchRegex = <TVerse extends VerseInput>(
  pattern: string,
  quranData: TVerse[],
  pagination: PaginationOptions = { page: 1, limit: 20 },
): SearchResponse<TVerse> => {
  const emptyResponse = (page: number, limit: number): SearchResponse<TVerse> => ({
    results: [],
    counts: { simple: 0, lemma: 0, root: 0, fuzzy: 0, total: 0 },
    pagination: {
      totalResults: 0,
      totalPages: 0,
      currentPage: page,
      limit,
    },
  });

  const page = Math.max(1, pagination.page ?? 1);
  const limit = Math.max(1, pagination.limit ?? 20);

  if (!pattern) return emptyResponse(page, limit);

  // Normalize Arabic diacritics in the pattern while preserving regex syntax
  const normalizedPattern = normalizeRegexPattern(pattern);

  const validation = validateRegex(normalizedPattern);
  if (!validation.valid) return emptyResponse(page, limit);

  let regex: RegExp;
  try {
    regex = new RegExp(normalizedPattern, 'gu');
  } catch {
    return emptyResponse(page, limit);
  }

  const combined: ScoredVerse<TVerse>[] = [];

  for (const verse of quranData) {
    const normalizedText = normalizeArabic(verse.standard);
    if (!normalizedText) continue;

    // Reset regex lastIndex for each verse (global flag)
    regex.lastIndex = 0;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalizedText)) !== null) {
      if (match[0]) matches.push(match[0]);
      // Prevent infinite loop for zero-length matches
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }

    if (matches.length > 0) {
      combined.push({
        ...verse,
        matchScore: matches.length,
        matchType: 'exact',
        matchedTokens: Array.from(new Set(matches)),
      });
    }
  }

  combined.sort((a, b) => b.matchScore - a.matchScore);

  const offset = (page - 1) * limit;
  const results = combined.slice(offset, offset + limit);
  const totalResults = combined.length;
  const totalPages = Math.ceil(totalResults / limit);

  const counts: SearchCounts = {
    simple: combined.filter((v) => v.matchType === 'exact').length,
    lemma: 0,
    root: 0,
    fuzzy: 0,
    total: combined.length,
  };

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
