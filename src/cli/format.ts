import type { QuranText, SearchCounts, SearchResponse } from '../types';
import { exportResults } from '../utils/export';
import type { OutputFormat } from './args';

/**
 * The help screen. Every option lists its default, so the tool is self-describing
 * without consulting the README.
 */
export const helpText = (): string =>
  `quran-search-engine — search the Quran from the terminal

Usage:
  quran-search-engine <query> [options]

Options take their value either way: --limit 5 or --limit=5

Matching (defaults match the library's own defaults):
  --lemma, --no-lemma      Word-family matching                    (default: on)
  --root, --no-root        Word-root matching                      (default: on)
  --fuzzy, --no-fuzzy      Approximate matching                    (default: on)
  --semantic               Related-concept matching                (default: off)
  --regex                  Treat the query as a pattern            (default: off)

Scope:
  --sura <n>               Restrict to one sura, 1 to 114          (default: all)
  --juz <n>                Restrict to one juz, 1 to 30            (default: all)

Results:
  --page <n>               Which page of results                   (default: 1)
  --limit <n>              Results per page                        (default: 20)

Output:
  --format <json|csv|tsv>  Machine-readable output       (default: readable table)
  --output <file>          Write results to a file             (default: stdout)

Other:
  -h, --help               Show this help
  --version                Show the installed version

No flag is needed for these — they are recognised from the query itself:
  Verse coordinates        "2:255", "1:1-7", "2:"
  Logical operators        "الله AND (الرحمن OR الرحيم)", "الله NOT الرحمن"
  Transliteration          "rahman" (single words; "bismi allah", not "bismillah")

Examples:
  quran-search-engine "رحم"
  quran-search-engine "رحمة" --format json | jq .
  quran-search-engine "الله" --page 3 --limit 50
  quran-search-engine "رحم" --sura 2 --no-fuzzy
  quran-search-engine "^.*ون$" --regex

Exit codes:
  0  completed (including when nothing matched)
  1  runtime error (data could not be loaded, file could not be written)
  2  invalid usage (unknown option, missing or blank query, bad value, unsafe pattern)

Combining --regex with --lemma, --root, --fuzzy or --semantic prints a warning on stderr
and continues: pattern matching runs on its own and ignores them.
`;

/**
 * Summarises which layers produced the matches, skipping the ones that produced none.
 *
 * `counts.simple` is reported as "exact" to match the `matchType` a reader sees, and
 * `counts.fuzzy` reports genuine fuzzy matches only — unscored matches, if any,
 * are counted in the totals but not attributed to any layer (see `SearchCounts`).
 * A range or regex query populates only its own field, so the zeros would be
 * noise rather than information.
 *
 * @param counts - The counts block from the search response.
 * @returns A one-line breakdown, or an empty string when there is nothing to report.
 */
const formatCounts = (counts: SearchCounts): string => {
  const labelled: [string, number][] = [
    ['exact', counts.simple],
    ['lemma', counts.lemma],
    ['root', counts.root],
    ['fuzzy', counts.fuzzy],
    ['semantic', counts.semantic],
    ['regex', counts.regex],
    ['range', counts.range],
  ];

  const present = labelled.filter(([, value]) => value > 0);
  if (present.length === 0) return '';

  return present.map(([label, value]) => `${label} ${value}`).join(' · ');
};

/**
 * Renders results for a terminal reader: one line per verse, then the totals so the
 * reader knows what they have not yet seen.
 *
 * @param response - The search response to render.
 * @param query - The original query, quoted back in the no-results message.
 * @returns A printable string, always newline-terminated.
 */
export const formatTable = (response: SearchResponse<QuranText>, query: string): string => {
  const { results, pagination } = response;

  if (results.length === 0) {
    return `No results for "${query}".\n`;
  }

  const rows = results.map((verse) => `${verse.sura_id}:${verse.aya_id}  ${verse.standard}`);

  const summary =
    `\nShowing ${results.length} of ${pagination.totalResults} ` +
    `${pagination.totalResults === 1 ? 'result' : 'results'} ` +
    `(page ${pagination.currentPage} of ${pagination.totalPages})`;

  const breakdown = formatCounts(response.counts);
  const matches = breakdown === '' ? '' : `\nMatches: ${breakdown}`;

  return `${rows.join('\n')}\n${summary}${matches}\n`;
};

/**
 * Picks the requested output shape. Machine-readable formats are delegated verbatim to
 * the library's `exportResults`, so the CLI adds no serialisation of its own and its
 * output stays identical to the library's.
 *
 * @param response - The search response to render.
 * @param format - The requested output shape.
 * @param query - The original query, used only by the table renderer.
 * @returns A printable string.
 */
export const formatResults = (
  response: SearchResponse<QuranText>,
  format: OutputFormat,
  query: string,
): string => {
  if (format === 'table') {
    return formatTable(response, query);
  }

  return `${exportResults(response, format)}\n`;
};
