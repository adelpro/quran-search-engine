import { search } from '../core/search';
import { InvalidPaginationError, InvalidQueryError, InvalidRegexError } from '../errors';
import type {
  AdvancedSearchOptions,
  MorphologyAya,
  PaginationOptions,
  QuranText,
  SearchContext,
  SearchCounts,
  SearchResponse,
  WordMap,
} from '../types';
import {
  loadMorphology,
  loadPhoneticData,
  loadQuranData,
  loadSemanticData,
  loadWordMap,
} from '../utils/loader';
import { isArabic } from '../utils/normalization';
import { validateRegex } from '../utils/regex-validation';
import { isUsageError, parseArgs } from './args';
import { formatResults, helpText } from './format';

/** Replaced at build time by tsup `define`; falls back for direct source execution. */
declare const __CLI_VERSION__: string;

/** Where the command writes. Injected so tests need no process mocking. */
export type CliIo = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

/**
 * Seams for testing. Every field defaults to the real implementation, so production
 * callers pass nothing.
 */
export type CliDeps = {
  loadQuranData?: () => Promise<Map<number, QuranText>>;
  loadMorphology?: () => Promise<Map<number, MorphologyAya>>;
  loadWordMap?: () => Promise<WordMap>;
  loadSemanticData?: () => Promise<Map<string, string[]>>;
  loadPhoneticData?: () => Promise<Map<string, string[]>>;
  writeFile?: (path: string, contents: string) => Promise<void>;
  version?: string;
};

/** Exit codes. A usage mistake is distinct from a failure while doing the work. */
const EXIT_SUCCESS = 0;
const EXIT_RUNTIME_ERROR = 1;
const EXIT_INVALID_USAGE = 2;

const resolveVersion = (deps: CliDeps): string => {
  if (deps.version !== undefined) return deps.version;
  return typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0-dev';
};

const writeToFile = async (path: string, contents: string): Promise<void> => {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path, contents, 'utf8');
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Narrows the corpus to the requested sura and juz before searching.
 *
 * `search()` accepts `suraId` and `juzId` but only honours them on its regex path — its
 * linguistic path ignores them entirely (`filterVerses` is applied inside the regex branch
 * of `src/core/search.ts` only). Scoping the input corpus rather than the results keeps the
 * reported totals and page counts correct, which post-filtering would not.
 *
 * @param data - The full verse map.
 * @param options - Parsed search options carrying the optional scope filters.
 * @returns The same map when no filter applies, otherwise a narrowed copy.
 */
const scopeCorpus = (
  data: Map<number, QuranText>,
  options: AdvancedSearchOptions,
): Map<number, QuranText> => {
  const { suraId, juzId } = options;
  if (suraId === undefined && juzId === undefined) return data;

  const scoped = new Map<number, QuranText>();
  for (const [gid, verse] of data) {
    if (suraId !== undefined && verse.sura_id !== suraId) continue;
    if (juzId !== undefined && verse.juz_id !== juzId) continue;
    scoped.set(gid, verse);
  }
  return scoped;
};

const NO_COUNTS: SearchCounts = {
  simple: 0,
  lemma: 0,
  root: 0,
  fuzzy: 0,
  range: 0,
  semantic: 0,
  regex: 0,
  total: 0,
};

/** An empty result set, for when a scope filter leaves no verses to search at all. */
const emptyResponse = (pagination: PaginationOptions): SearchResponse<QuranText> => ({
  results: [],
  counts: NO_COUNTS,
  pagination: {
    totalResults: 0,
    totalPages: 0,
    currentPage: pagination.page ?? 1,
    limit: pagination.limit ?? 20,
  },
});

/**
 * Runs one search and returns the exit code. Never calls `process.exit`, so the whole
 * command is testable without mocking process termination.
 *
 * @param argv - Arguments after the node binary and script path.
 * @param io - Destinations for results (stdout) and diagnostics (stderr).
 * @param deps - Optional overrides for data loading, file writing and version reporting.
 * @returns 0 on success (including no results), 1 on runtime fault, 2 on invalid usage.
 */
export const run = async (argv: string[], io: CliIo, deps: CliDeps = {}): Promise<number> => {
  const parsed = parseArgs(argv);

  if (isUsageError(parsed)) {
    io.stderr(`${parsed.message}\n`);
    return EXIT_INVALID_USAGE;
  }

  if (parsed.mode === 'help') {
    io.stdout(helpText());
    return EXIT_SUCCESS;
  }

  if (parsed.mode === 'version') {
    io.stdout(`${resolveVersion(deps)}\n`);
    return EXIT_SUCCESS;
  }

  const { query, options, pagination, format, output, warnings } = parsed;

  for (const warning of warnings) {
    io.stderr(`Warning: ${warning}\n`);
  }

  // Validate the pattern before loading megabytes of data, so a bad pattern fails fast.
  if (options.isRegex === true) {
    try {
      validateRegex(query);
    } catch (error) {
      io.stderr(
        `${describe(error)}\nCheck the pattern, or drop --regex to search for these characters literally.\n`,
      );
      return EXIT_INVALID_USAGE;
    }
  }

  let context: SearchContext<QuranText>;
  try {
    const [quranData, morphologyMap, wordMap] = await Promise.all([
      (deps.loadQuranData ?? loadQuranData)(),
      (deps.loadMorphology ?? loadMorphology)(),
      (deps.loadWordMap ?? loadWordMap)(),
    ]);

    // Load the optional datasets only when this query can actually use them: semantic
    // data under --semantic, phonetic data only for non-Arabic input.
    const semanticMap =
      options.semantic === true ? await (deps.loadSemanticData ?? loadSemanticData)() : undefined;
    const phoneticMap = isArabic(query)
      ? undefined
      : await (deps.loadPhoneticData ?? loadPhoneticData)();

    context = {
      quranData: scopeCorpus(quranData, options),
      morphologyMap,
      wordMap,
      semanticMap,
      phoneticMap,
    };
  } catch (error) {
    io.stderr(
      `Could not load the Quran data: ${describe(error)}\nThe installed package may be incomplete — try reinstalling quran-search-engine.\n`,
    );
    return EXIT_RUNTIME_ERROR;
  }

  let rendered: string;
  try {
    // A scope filter can legitimately leave nothing to search — an out-of-range --sura, say.
    // search() treats an empty corpus as a missing dependency and throws, so answer directly.
    const response =
      context.quranData.size === 0
        ? emptyResponse(pagination)
        : search(query, context, options, pagination);
    rendered = formatResults(response, format, query);
  } catch (error) {
    // These three mean the input was unacceptable, not that the run broke.
    if (
      error instanceof InvalidQueryError ||
      error instanceof InvalidPaginationError ||
      error instanceof InvalidRegexError
    ) {
      io.stderr(`${describe(error)}\n`);
      return EXIT_INVALID_USAGE;
    }

    io.stderr(`Search failed: ${describe(error)}\n`);
    return EXIT_RUNTIME_ERROR;
  }

  if (output !== undefined) {
    try {
      await (deps.writeFile ?? writeToFile)(output, rendered);
    } catch (error) {
      io.stderr(
        `Could not write to "${output}": ${describe(error)}\nCheck that the directory exists and is writable.\n`,
      );
      return EXIT_RUNTIME_ERROR;
    }
    return EXIT_SUCCESS;
  }

  io.stdout(rendered);
  return EXIT_SUCCESS;
};
