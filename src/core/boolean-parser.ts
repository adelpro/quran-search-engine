import { normalizeArabic } from '../utils/normalization';
import type { BooleanQuery, BooleanNode, BooleanGroup, BooleanOperator } from '../types';

/**
 * Returns true if the raw query string contains boolean operator syntax:
 * a standalone "|" token, or a token starting with "+" or "-".
 * Must operate on the raw string BEFORE normalizeArabic() strips non-Arabic chars.
 */
export const hasBooleanOperators = (query: string): boolean => {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.some((t) => t.includes('|') || t.startsWith('+') || t.startsWith('-'));
};

/**
 * Parses a raw query string into a BooleanQuery AST.
 * OR groups are separated by a standalone "|" token.
 * Within each group, terms prefixed with "+" are MUST, "-" are NOT, plain are AND.
 * Term text is normalized via normalizeArabic() before storage.
 */
export const parseBooleanQuery = (query: string): BooleanQuery => {
  // Normalize double pipes to single pipes before splitting
  const normalized = query.replace(/\|{2,}/g, '|');
  const rawGroups = normalized.split(/\s*\|\s*/);

  const groups: BooleanGroup[] = rawGroups.map((groupStr): BooleanGroup => {
    const rawTokens = groupStr.trim().split(/\s+/).filter(Boolean);

    const nodes: BooleanNode[] = rawTokens
      .map((token): BooleanNode | null => {
        let operator: BooleanOperator = 'and';
        let term = token;

        if (token.startsWith('+')) {
          operator = 'and';
          term = token.slice(1);
        } else if (token.startsWith('-')) {
          operator = 'not';
          term = token.slice(1);
        }

        // Strip any remaining leading +/- from stacked operators like +-term
        term = term.replace(/^[+-]+/, '');

        const normalizedTerm = normalizeArabic(term);
        if (!normalizedTerm) return null;

        return { operator, term: normalizedTerm };
      })
      .filter((n): n is BooleanNode => n !== null);

    return { nodes };
  });

  return { type: 'boolean', groups };
};
