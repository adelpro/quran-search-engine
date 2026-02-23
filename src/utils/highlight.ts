import { normalizeArabic } from './normalization';
import type { MatchType } from '../types';

export type HighlightRange = {
  start: number;
  end: number;
  token: string;
  matchType: MatchType;
};

type InternalMatchRange = HighlightRange & {
  priority: number;
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createDiacriticRegex = (token: string) => {
  const normalizedToken = normalizeArabic(token);
  const escaped = escapeRegExp(normalizedToken);
  const tashkeel = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*?';

  const letters = escaped.split('').map((char) => {
    if (char === 'ا') return '[اأإآٱ\\u0670و]';
    if (char === 'ي') return '[يى\\u06CC\\u0626]';
    if (char === 'ى') return '[ىي\\u06CC\\u0626]';
    if (char === 'ة') return '[ةهت]';
    if (char === 'ه') return '[هة]';
    if (char === 'ك') return '[ك\\u06AC\\u06AD\\u06AE\\u06AF\\u06B0]';
    if (char === 'ء') return '[ءؤئ]';
    if (char === 'و') return '[وؤ]';
    return char;
  });

  const tokenPattern = letters.join(tashkeel);
  return new RegExp(`([^\\s]*${tokenPattern}[^\\s]*)`, 'gu');
};
/**
 * Identifies the exact character positions (ranges) in a text that match search tokens.
 * Used for highlighting search results in the UI.
 *
 * Returns empty array if matchedTokens don't exist or has a length of 0
 *
 * @param text - The verse string
 * @param matchedTokens - The tokens identified by the search engine
 * @param tokenTypes - Mapping of tokens to their match type (exact, lemma, root).
 * @returns An array of highlight ranges sorted by position.
 *
 * @example
 * getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes)
 * // returns [{start: 1, end: 6, token:"الحمد", matchType:"lemma"},
 * //          {start: 10, end: 14, token:"الله", matchType:"exact"},...]
 */
export const getHighlightRanges = (
  text: string,
  matchedTokens: readonly string[] | undefined,
  tokenTypes?: Record<string, MatchType>,
): HighlightRange[] => {
  if (!matchedTokens || matchedTokens.length === 0) return [];

  const matches: InternalMatchRange[] = [];

  for (const token of matchedTokens) {
    const regex = createDiacriticRegex(token);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchType = tokenTypes?.[token] ?? 'fuzzy';
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        token,
        matchType: matchType === 'none' ? 'fuzzy' : matchType,
        priority: match[0].length,
      });
    }
  }

  matches.sort((a, b) => {
    // 1. Longest matched text wins (e.g., "Abdullah" beats "Abd")
    if (a.priority !== b.priority) return b.priority - a.priority;

    // 2. Tie-breaker: If two different search tokens resulted in the
    // exact same matched word (due to the greedy regex `[^\\s]*`),
    // we prioritize the longer, more specific search token.
    if (a.token.length !== b.token.length) return b.token.length - a.token.length;

    // 3. Earliest starting index wins
    return a.start - b.start;
  });

  const finalRanges: InternalMatchRange[] = [];
  const occupied = new Array(text.length).fill(false);

  for (const m of matches) {
    let isFree = true;
    for (let i = m.start; i < m.end; i++) {
      if (occupied[i]) {
        isFree = false;
        break;
      }
    }

    if (!isFree) continue;

    finalRanges.push(m);
    for (let i = m.start; i < m.end; i++) {
      occupied[i] = true;
    }
  }

  finalRanges.sort((a, b) => a.start - b.start);

  return finalRanges.map(({ priority: _priority, ...range }) => range);
};
