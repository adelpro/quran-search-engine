import { describe, expect, it } from 'vitest';
import { isUsageError, parseArgs, type CliOptions } from './args';

/** Parses and asserts success, returning the options for further assertions. */
const parseOk = (argv: string[]): CliOptions => {
  const result = parseArgs(argv);
  if (isUsageError(result)) {
    throw new Error(`expected success but got usage error: ${result.message}`);
  }
  return result;
};

/** Parses and asserts a usage error, returning it for message assertions. */
const parseError = (argv: string[]): { message: string; flag?: string } => {
  const result = parseArgs(argv);
  if (!isUsageError(result)) {
    throw new Error('expected a usage error but parsing succeeded');
  }
  return result;
};

describe('parseArgs', () => {
  describe('defaults', () => {
    it('mirrors the library defaults', () => {
      const parsed = parseOk(['رحم']);

      expect(parsed.query).toBe('رحم');
      expect(parsed.mode).toBe('search');
      expect(parsed.options).toMatchObject({
        lemma: true,
        root: true,
        fuzzy: true,
        semantic: false,
        isRegex: false,
      });
      expect(parsed.pagination).toEqual({ page: 1, limit: 20 });
      expect(parsed.format).toBe('table');
      expect(parsed.output).toBeUndefined();
      expect(parsed.warnings).toEqual([]);
    });

    it('applies no sura or juz filter by default', () => {
      const parsed = parseOk(['رحم']);

      expect(parsed.options.suraId).toBeUndefined();
      expect(parsed.options.juzId).toBeUndefined();
    });
  });

  describe('query handling', () => {
    it('rejects a missing query', () => {
      expect(parseError([]).message).toMatch(/query is required/i);
    });

    it.each([
      ['empty string', ''],
      ['spaces', '   '],
      ['a tab', '\t'],
    ])('rejects a blank query (%s)', (_label, query) => {
      // The library throws InvalidQueryError for these; rejecting here keeps that off the
      // runtime path, where it would report as a runtime fault rather than a usage error.
      expect(parseError([query]).message).toMatch(/query is empty/i);
    });

    it.each(['!!!', '...'])('accepts a punctuation-only query (%s)', (query) => {
      // Not blank: this is a valid search that simply matches nothing.
      expect(parseOk([query]).query).toBe(query);
    });

    it('rejects several positionals and says to quote the query', () => {
      const error = parseError(['الله', 'الرحمن']);

      expect(error.message).toMatch(/single query/i);
      expect(error.message).toMatch(/quote/i);
    });
  });

  describe('help and version', () => {
    it.each(['--help', '-h'])('treats %s as a mode rather than exiting', (flag) => {
      expect(parseOk([flag]).mode).toBe('help');
    });

    it('treats --version as a mode rather than exiting', () => {
      expect(parseOk(['--version']).mode).toBe('version');
    });

    it('does not require a query for help or version', () => {
      expect(isUsageError(parseArgs(['--help']))).toBe(false);
      expect(isUsageError(parseArgs(['--version']))).toBe(false);
    });
  });

  describe('matching toggles', () => {
    it.each([
      ['--no-lemma', 'lemma'],
      ['--no-root', 'root'],
      ['--no-fuzzy', 'fuzzy'],
    ] as const)('%s turns off %s', (flag, key) => {
      expect(parseOk(['رحم', flag]).options[key]).toBe(false);
    });

    it.each([
      ['--semantic', 'semantic'],
      ['--regex', 'isRegex'],
    ] as const)('%s turns on %s', (flag, key) => {
      expect(parseOk(['رحم', flag]).options[key]).toBe(true);
    });
  });

  describe('numeric options', () => {
    it('parses page, limit, sura and juz', () => {
      const parsed = parseOk(['رحم', '--page', '3', '--limit', '5', '--sura', '2', '--juz', '1']);

      expect(parsed.pagination).toEqual({ page: 3, limit: 5 });
      expect(parsed.options.suraId).toBe(2);
      expect(parsed.options.juzId).toBe(1);
    });

    it('accepts the --flag=value form', () => {
      expect(parseOk(['رحم', '--page=4']).pagination.page).toBe(4);
    });

    it.each(['0', '-1', 'abc', '1.5'])('rejects --limit %s', (value) => {
      expect(parseError(['رحم', '--limit', value]).flag).toBe('--limit');
    });

    it('rejects a numeric option with no value', () => {
      expect(parseError(['رحم', '--sura']).message).toMatch(/needs a value/i);
    });

    it.each([
      ['--sura', '115', '1 to 114'],
      ['--sura', '999', '1 to 114'],
      ['--juz', '31', '1 to 30'],
    ])('rejects %s %s as out of range', (flag, value, expected) => {
      // Out of range is a usage mistake. Returning nothing would read as "no matches in that
      // sura" when the sura does not exist.
      const error = parseError(['رحم', flag, value]);

      expect(error.flag).toBe(flag);
      expect(error.message).toContain(expected);
    });

    it.each([
      ['--sura', '114'],
      ['--juz', '30'],
    ])('accepts %s %s at the upper bound', (flag, value) => {
      expect(isUsageError(parseArgs(['رحم', flag, value]))).toBe(false);
    });

    it.each(['--page', '--limit'])('leaves %s unbounded, since it paginates results', (flag) => {
      expect(parseOk(['رحم', flag, '99999']).pagination).toMatchObject({});
    });

    it('mentions the range when a bounded flag is missing its value', () => {
      expect(parseError(['رحم', '--juz']).message).toContain('1 to 30');
    });
  });

  describe('output options', () => {
    it.each(['json', 'csv', 'tsv'] as const)('accepts --format %s', (format) => {
      expect(parseOk(['رحم', '--format', format]).format).toBe(format);
    });

    it('rejects an unsupported format and names the supported ones', () => {
      const error = parseError(['رحم', '--format', 'yaml']);

      expect(error.message).toContain('json');
      expect(error.message).toContain('csv');
      expect(error.message).toContain('tsv');
    });

    it('rejects --format with no value', () => {
      expect(parseError(['رحم', '--format']).flag).toBe('--format');
    });

    it('captures --output', () => {
      expect(parseOk(['رحم', '--output', 'results.json']).output).toBe('results.json');
    });

    it('rejects --output with no value', () => {
      expect(parseError(['رحم', '--output']).message).toMatch(/file path/i);
    });
  });

  describe('unknown options', () => {
    it('rejects rather than ignoring, and names the flag', () => {
      const error = parseError(['رحم', '--nonsense']);

      expect(error.flag).toBe('--nonsense');
      expect(error.message).toContain('--nonsense');
      expect(error.message).toMatch(/--help/);
    });
  });

  describe('repeated options', () => {
    it('takes the last value of a repeated valued option', () => {
      expect(parseOk(['رحم', '--page', '2', '--page', '3']).pagination.page).toBe(3);
    });

    it.each([
      [['--lemma', '--no-lemma'], false],
      [['--no-lemma', '--lemma'], true],
    ] as const)('resolves %s to the last occurrence', (flags, expected) => {
      expect(parseOk(['رحم', ...flags]).options.lemma).toBe(expected);
    });
  });

  describe('regex warnings', () => {
    it.each(['--lemma', '--root', '--fuzzy', '--semantic'])(
      'warns that %s has no effect with --regex',
      (flag) => {
        const parsed = parseOk(['رحم', '--regex', flag]);

        expect(parsed.warnings).toHaveLength(1);
        expect(parsed.warnings[0]).toContain(flag);
      },
    );

    it('collects one warning listing every ignored option', () => {
      const parsed = parseOk(['رحم', '--regex', '--lemma', '--semantic']);

      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0]).toContain('--lemma');
      expect(parsed.warnings[0]).toContain('--semantic');
    });

    it('does not warn when --regex is used alone', () => {
      expect(parseOk(['رحم', '--regex']).warnings).toEqual([]);
    });

    it('does not warn about defaults the user did not ask for', () => {
      // lemma/root/fuzzy default to on; only an explicit flag earns a warning.
      expect(parseOk(['^.*ون$', '--regex']).warnings).toEqual([]);
    });
  });
});
