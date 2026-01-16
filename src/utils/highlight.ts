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
    if (a.priority !== b.priority) return b.priority - a.priority;
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
