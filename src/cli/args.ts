import type { AdvancedSearchOptions, PaginationOptions } from '../types';
import type { ExportFormat } from '../utils/export';

/** Output shapes the CLI can produce: the machine-readable ones plus the default table. */
export type OutputFormat = ExportFormat | 'table';

/** What the invocation is asking for. `help` and `version` are parse outcomes, not exits. */
export type CliMode = 'search' | 'help' | 'version';

/**
 * A fully parsed command line, grouped so `run` can hand each part straight to `search()`
 * without rearranging fields.
 */
export type CliOptions = {
  query: string;
  options: AdvancedSearchOptions;
  pagination: PaginationOptions;
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

/** Options the regex layer ignores; combining them with `--regex` earns a warning. */
const REGEX_IGNORED_FLAGS = ['--lemma', '--root', '--fuzzy', '--semantic'] as const;

/** Narrows a parse result to the error case. */
export const isUsageError = (result: CliOptions | CliUsageError): result is CliUsageError =>
  'message' in result;

const usageError = (message: string, flag?: string): CliUsageError => ({ message, flag });

/**
 * Parses a positive integer, rejecting `0`, negatives, decimals and non-numeric input.
 * Shared by `--page`, `--limit`, `--sura` and `--juz` so their messages stay consistent.
 */
const parsePositiveInteger = (flag: string, raw: string | undefined): number | CliUsageError => {
  if (raw === undefined || raw === '') {
    return usageError(
      `${flag} needs a value: a positive whole number, for example ${flag} 2`,
      flag,
    );
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return usageError(
      `${flag} must be a positive whole number, but got "${raw}". Use ${flag} 2 or higher.`,
      flag,
    );
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
  const pagination: PaginationOptions = { page: 1, limit: 20 };
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
        const value = parsePositiveInteger(flag, takeValue());
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

  if (positionals.length > 1) {
    return usageError(
      `Expected a single query but received ${positionals.length} arguments. Quote the whole query, for example: quran-search-engine "الله الرحمن"`,
    );
  }

  const query = positionals[0] ?? '';

  // A blank query is the same mistake as no query. Rejecting it here keeps the library's
  // InvalidQueryError off the runtime path, where it would surface as a runtime fault
  // instead of the usage error it is. Punctuation-only queries are not blank: they search
  // normally and simply match nothing.
  if (query.trim() === '') {
    return usageError(
      'The search query is empty. Provide a word or phrase to search for, for example: quran-search-engine "رحم"',
    );
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

  return { query, options, pagination, format, output, mode, warnings };
};
