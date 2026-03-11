import { InvalidRegexError } from '../errors';

/**
 * Heuristic patterns that are strongly associated with catastrophic backtracking (ReDoS).
 * These cover the most common evil-regex families:
 *   - Nested quantifiers:  (a+)+  (a*)*  (a+)*  (a|aa)+
 *   - Alternation with overlap inside a quantified group: (a|a)+
 */
const REDOS_PATTERNS = [
  // Nested quantifiers: (X+)+  (X*)* etc.
  /\([^)]*[+*][^)]*\)[+*]/,
  // Quantified group containing alternation: (a|b)+  or  (?:a|b)*
  /\([^)]*\|[^)]*\)[+*{]/,
];

/**
 * Validates a user-supplied regex string for:
 * 1. Syntactic correctness — tries to construct a RegExp.
 * 2. Safety — rejects patterns known to cause catastrophic backtracking.
 *
 * @param pattern - The raw regex string from the user.
 * @throws {InvalidRegexError} if the pattern is invalid or unsafe.
 * @returns A compiled `RegExp` ready for use against normalized Arabic text.
 */
export const validateRegex = (pattern: string): RegExp => {
  // 1. Syntax check
  let compiled: RegExp;
  try {
    compiled = new RegExp(pattern, 'u');
  } catch {
    throw new InvalidRegexError(pattern, 'pattern is not valid regular expression syntax');
  }

  // 2. Safety check — heuristic ReDoS detection
  for (const dangerous of REDOS_PATTERNS) {
    if (dangerous.test(pattern)) {
      throw new InvalidRegexError(
        pattern,
        'pattern contains nested quantifiers that may cause catastrophic backtracking',
      );
    }
  }

  return compiled;
};
