import type { AdvancedSearchOptions, MultiTermOptions, RankBy } from '../types';
import type { ExportFormat } from '../utils/export';

/** Output shapes the CLI can produce: the machine-readable ones plus the default table. */
export type OutputFormat = ExportFormat | 'table';

/** What the invocation is asking for. `help` and `version` are parse outcomes, not exits. */
export type CliMode = 'search' | 'help' | 'version';

/**
 * A fully parsed command line, grouped so `run` can hand each part straight to `search()`
 * without rearranging fields.
 *
 * `query` is a `string[]` only for the array form (a single positional wrapped in `[ ... ]`,
 * e.g. `"[محمد, يونس]"`) — that alone maps onto `search()`'s `string[]` overload. Any other
 * positional(s) stay a single `string`; two or more bare positionals are joined with `AND`
 * first. `pagination` is typed as `MultiTermOptions` (pagination plus `rankBy`) rather than
 * plain `PaginationOptions` so the very same object can be handed to either overload
 * unmodified — the string overload's `pagination` parameter structurally ignores the extra
 * `rankBy` field, exactly like `core/search.ts` itself reuses one `multiTermOptions`
 * parameter as `pagination` internally.
 */
export type CliOptions = {
  query: string | string[];
  options: AdvancedSearchOptions;
  pagination: MultiTermOptions;
  format: OutputFormat;
  output?: string;
  mode: CliMode;
  /** Non-fatal diagnostics collected while parsing. Written by `run`, never by the parser. */
  warnings: string[];
};

/** Returned rather than thrown, so callers keep usage errors distinct from runtime faults. */
export type CliUsageError = {
  message: string;
  flag?: string;
};

const EXPORT_FORMATS: readonly ExportFormat[] = ['json', 'csv', 'tsv'];
const RANK_BY_VALUES: readonly RankBy[] = ['score', 'coverage', 'frequency'];

// Fixed properties of the mushaf, so they are safe to state here. Deliberately not derived
// from the exported SURAS constant: that module imports quran.json at load time, and pulling
// the corpus into the parser would make even `--help` pay for it.
const SURA_COUNT = 114;
const JUZ_COUNT = 30;

/** Options the regex layer ignores; combining them with `--regex` earns a warning. */
const REGEX_IGNORED_FLAGS = ['--lemma', '--root', '--fuzzy', '--semantic'] as const;

/** Narrows a parse result to the error case. */
export const isUsageError = (result: CliOptions | CliUsageError): result is CliUsageError =>
  'message' in result;

const usageError = (message: string, flag?: string): CliUsageError => ({ message, flag });

/**
 * Parses a positive integer, rejecting `0`, negatives, decimals and non-numeric input.
 * Shared by `--page`, `--limit`, `--sura` and `--juz` so their messages stay consistent.
 *
 * @param flag - The flag being parsed, used in the message.
 * @param raw - The raw value, if one was supplied.
 * @param max - Upper bound, for flags that address a fixed range like suras or juz.
 * @returns The parsed number, or a usage error explaining what to change.
 */
const parsePositiveInteger = (
  flag: string,
  raw: string | undefined,
  max?: number,
): number | CliUsageError => {
  const expected =
    max === undefined ? 'a positive whole number' : `a whole number from 1 to ${max}`;

  if (raw === undefined || raw === '') {
    return usageError(`${flag} needs a value: ${expected}, for example ${flag} 2`, flag);
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return usageError(
      `${flag} must be ${expected}, but got "${raw}". Use ${flag} 2 or higher.`,
      flag,
    );
  }

  // Out of range is a usage mistake, not an empty search: returning nothing for --sura 999
  // reads as "this sura has no matches" when the sura does not exist at all.
  if (max !== undefined && value > max) {
    return usageError(`${flag} must be ${expected}, but got "${raw}".`, flag);
  }

  return value;
};

/**
 * Parses argv into `CliOptions`, or returns a `CliUsageError` describing what to change.
 *
 * Pure: no filesystem, no process, no output. Every default matches the library's own
 * defaults so terminal results match `search()` for the same query.
 *
 * @param argv - Arguments after the node binary and script path.
 * @returns Parsed options, or a usage error.
 */
export const parseArgs = (argv: string[]): CliOptions | CliUsageError => {
  const options: AdvancedSearchOptions = {
    lemma: true,
    root: true,
    fuzzy: true,
    semantic: false,
    isRegex: false,
  };
  const pagination: MultiTermOptions = { page: 1, limit: 20, rankBy: 'score' };
  const positionals: string[] = [];
  const explicitFlags = new Set<string>();

  let format: OutputFormat = 'table';
  let output: string | undefined;
  let mode: CliMode = 'search';

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;

    if (!argument.startsWith('-') || argument === '-') {
      positionals.push(argument);
      continue;
    }

    // Support both "--flag value" and "--flag=value".
    const separator = argument.indexOf('=');
    const flag = separator === -1 ? argument : argument.slice(0, separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);
    const takeValue = (): string | undefined => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('-')) return undefined;
      index += 1;
      return next;
    };

    explicitFlags.add(flag);

    switch (flag) {
      case '--help':
      case '-h':
        mode = 'help';
        break;
      case '--version':
        mode = 'version';
        break;

      case '--lemma':
        options.lemma = true;
        break;
      case '--no-lemma':
        options.lemma = false;
        break;
      case '--root':
        options.root = true;
        break;
      case '--no-root':
        options.root = false;
        break;
      case '--fuzzy':
        options.fuzzy = true;
        break;
      case '--no-fuzzy':
        options.fuzzy = false;
        break;
      case '--semantic':
        options.semantic = true;
        break;
      case '--regex':
        options.isRegex = true;
        break;

      case '--sura':
      case '--juz':
      case '--page':
      case '--limit': {
        const bound = flag === '--sura' ? SURA_COUNT : flag === '--juz' ? JUZ_COUNT : undefined;
        const value = parsePositiveInteger(flag, takeValue(), bound);
        if (typeof value !== 'number') return value;
        if (flag === '--sura') options.suraId = value;
        else if (flag === '--juz') options.juzId = value;
        else if (flag === '--page') pagination.page = value;
        else pagination.limit = value;
        break;
      }

      case '--format': {
        const value = takeValue();
        if (value === undefined) {
          return usageError(
            `--format needs a value. Available formats: ${EXPORT_FORMATS.join(', ')}.`,
            flag,
          );
        }
        if (!EXPORT_FORMATS.includes(value as ExportFormat)) {
          return usageError(
            `--format does not support "${value}". Available formats: ${EXPORT_FORMATS.join(', ')}.`,
            flag,
          );
        }
        format = value as ExportFormat;
        break;
      }

      case '--output': {
        const value = takeValue();
        if (value === undefined) {
          return usageError('--output needs a file path, for example --output results.json', flag);
        }
        output = value;
        break;
      }

      case '--rank-by': {
        const value = takeValue();
        if (value === undefined) {
          return usageError(
            `--rank-by needs a value. Available modes: ${RANK_BY_VALUES.join(', ')}.`,
            flag,
          );
        }
        if (!RANK_BY_VALUES.includes(value as RankBy)) {
          return usageError(
            `--rank-by does not support "${value}". Available modes: ${RANK_BY_VALUES.join(', ')}.`,
            flag,
          );
        }
        pagination.rankBy = value as RankBy;
        break;
      }

      default:
        return usageError(
          `Unknown option "${flag}". Run with --help to see the available options.`,
          flag,
        );
    }
  }

  // --help and --version answer without a query, so stop before query validation.
  if (mode !== 'search') {
    return { query: '', options, pagination, format, output, mode, warnings: [] };
  }

  if (positionals.length === 0) {
    return usageError(
      'A search query is required. For example: quran-search-engine "رحم" — run with --help for options.',
    );
  }

  // A single positional wrapped in [ ... ] is the array form — search()'s own string[]
  // overload, invoked directly: quran-search-engine "[محمد, يونس]" independently searches
  // each term and merges the results by verse. Anything else — one bare positional, or
  // several — is a single string, exactly what search()'s string overload already takes.
  const firstPositional = positionals[0] ?? '';
  const isArrayQuery =
    positionals.length === 1 &&
    firstPositional.trim().startsWith('[') &&
    firstPositional.trim().endsWith(']');

  let query: string | string[];

  if (isArrayQuery) {
    const raw = firstPositional.trim();
    const inner = raw.slice(1, -1).trim();
    // Split on either the ASCII comma or the Arabic comma (،, U+060C) — an Arabic-language
    // CLI should accept the punctuation its own users actually type.
    const terms = inner === '' ? [] : inner.split(/[,،]/).map((term) => term.trim());

    // A blank term is the same mistake as no query. Rejecting it here keeps the library's
    // InvalidQueryError off the runtime path, where it would surface as a runtime fault
    // instead of the usage error it is. "[]" is deliberately not an error: search([]) is a
    // well-formed, empty multi-term search, not a mistake.
    const blankIndex = terms.findIndex((term) => term === '');
    if (blankIndex !== -1) {
      return usageError(
        `Term ${blankIndex + 1} in "${raw}" is empty. Each term must contain text to search for, or use "[]" for none.`,
      );
    }
    query = terms;
  } else {
    // Two or more bare positionals rejoin into one multi-word string, same as if they had
    // been quoted together in the first place — quran-search-engine محمد رسول becomes
    // "محمد رسول". search()'s normal (non-boolean-operator) string path already runs an
    // AND/intersection search over every token in a multi-word string (see simpleSearch in
    // core/layers/simple-search.ts), so this needs no operator syntax of its own. For a
    // single positional the join is a no-op, so this also covers that case unchanged.
    const blankIndex = positionals.findIndex((term) => term.trim() === '');
    if (blankIndex !== -1) {
      return usageError(
        positionals.length === 1
          ? 'The search query is empty. Provide a word or phrase to search for, for example: quran-search-engine "رحم"'
          : `Argument ${blankIndex + 1} ("${positionals[blankIndex]}") is empty. Each search term must contain text.`,
      );
    }
    query = positionals.join(' ');
  }

  const warnings: string[] = [];
  if (options.isRegex) {
    const ignored = REGEX_IGNORED_FLAGS.filter((candidate) => explicitFlags.has(candidate));
    if (ignored.length > 0) {
      warnings.push(
        `${ignored.join(', ')} has no effect with --regex: pattern matching runs on its own and skips lemma, root, fuzzy and semantic matching. Remove --regex to use them.`,
      );
    }
  }
  if (!isArrayQuery && explicitFlags.has('--rank-by')) {
    warnings.push(
      '--rank-by has no effect outside the array form, e.g. "[term, term]": ranking only applies to independent multi-term search.',
    );
  }

  return { query, options, pagination, format, output, mode, warnings };
};
