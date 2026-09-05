import { describe, expect, it } from 'vitest';
import type { MorphologyAya, QuranText, WordMap } from '../types';
import { run, type CliDeps, type CliIo } from './run';

/**
 * A small fixture rather than the bundled corpus: the real data costs ~210 ms to load per
 * call, and these tests are about the CLI's behavior, not the search engine's.
 */
const verse = (gid: number, sura: number, aya: number, standard: string, juz = 1): QuranText => ({
  gid,
  sura_id: sura,
  aya_id: aya,
  aya_id_display: String(aya),
  uthmani: standard,
  standard,
  standard_full: standard,
  page_id: 1,
  juz_id: juz,
  sura_name: 'الفاتحة',
  sura_name_en: 'The Opening',
  sura_name_romanization: 'Al-Fatihah',
});

// `الرحمن` deliberately appears in both suras and both juz values: a scope-filter test
// against a term confined to one sura would pass even if no filtering happened at all.
const FIXTURE: QuranText[] = [
  verse(1, 1, 1, 'بسم الله الرحمن الرحيم'),
  verse(2, 1, 2, 'الحمد لله رب العالمين'),
  verse(3, 1, 3, 'الرحمن الرحيم'),
  verse(4, 2, 1, 'ذلك الكتاب الرحمن لا ريب فيه', 2),
  verse(5, 2, 2, 'هدى للمتقين الرحمن', 2),
];

const MORPHOLOGY: Map<number, MorphologyAya> = new Map(
  FIXTURE.map((v) => [v.gid, { gid: v.gid, lemmas: [], roots: [] }]),
);

const testDeps = (overrides: CliDeps = {}): CliDeps => ({
  loadQuranData: () => Promise.resolve(new Map(FIXTURE.map((v) => [v.gid, v]))),
  loadMorphology: () => Promise.resolve(MORPHOLOGY),
  loadWordMap: () => Promise.resolve(new Map() as WordMap),
  loadSemanticData: () => Promise.resolve(new Map<string, string[]>()),
  loadPhoneticData: () => Promise.resolve(new Map<string, string[]>()),
  version: '9.9.9',
  ...overrides,
});

/** Collects both streams so tests can assert on each independently. */
const capture = (): { io: CliIo; out: () => string; err: () => string } => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    out: () => stdout.join(''),
    err: () => stderr.join(''),
  };
};

const invoke = async (
  argv: string[],
  overrides: CliDeps = {},
): Promise<{ code: number; out: string; err: string }> => {
  const { io, out, err } = capture();
  const code = await run(argv, io, testDeps(overrides));
  return { code, out: out(), err: err() };
};

describe('run', () => {
  describe('exit code 0 — completed', () => {
    it('finds matches and writes them to stdout', async () => {
      const { code, out, err } = await invoke(['الرحمن']);

      expect(code).toBe(0);
      expect(out).toContain('1:1');
      expect(err).toBe('');
    });

    it('reports no results as a success, explicitly', async () => {
      const { code, out } = await invoke(['زقفونة']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });

    it('treats a punctuation-only query as a search that matches nothing', async () => {
      const { code, out } = await invoke(['!!!']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });

    it('answers --help on stdout', async () => {
      const { code, out } = await invoke(['--help']);

      expect(code).toBe(0);
      expect(out).toContain('--format');
    });

    it('reports the injected version, so it cannot drift from package.json', async () => {
      const { code, out } = await invoke(['--version']);

      expect(code).toBe(0);
      expect(out.trim()).toBe('9.9.9');
    });

    it('resolves a range query without any flag', async () => {
      const { code, out } = await invoke(['1:1-3']);

      expect(code).toBe(0);
      expect(out).toContain('1:1');
      expect(out).toContain('1:3');
    });
  });

  describe('exit code 2 — invalid usage', () => {
    it('rejects a missing query on stderr', async () => {
      const { code, out, err } = await invoke([]);

      expect(code).toBe(2);
      expect(err).toMatch(/query is required/i);
      expect(out).toBe('');
    });

    it.each([
      ['empty string', ''],
      ['whitespace', '   '],
    ])('rejects a blank query (%s)', async (_label, query) => {
      const { code, err } = await invoke([query]);

      expect(code).toBe(2);
      expect(err).toMatch(/query is empty/i);
    });

    it('rejects an unknown flag', async () => {
      const { code, err } = await invoke(['رحم', '--nonsense']);

      expect(code).toBe(2);
      expect(err).toContain('--nonsense');
    });

    it('rejects an unsupported format', async () => {
      const { code, err } = await invoke(['رحم', '--format', 'yaml']);

      expect(code).toBe(2);
      expect(err).toContain('json');
    });

    it('rejects an invalid pattern promptly rather than hanging', async () => {
      const { code, err } = await invoke(['(((', '--regex']);

      expect(code).toBe(2);
      expect(err).not.toBe('');
    });
  });

  describe('exit code 1 — runtime fault', () => {
    it('reports unloadable data', async () => {
      const { code, out, err } = await invoke(['رحم'], {
        loadQuranData: () => Promise.reject(new Error('quran.json is missing')),
      });

      expect(code).toBe(1);
      expect(err).toMatch(/could not load/i);
      expect(err).toContain('quran.json is missing');
      expect(out).toBe('');
    });

    it('reports an unwritable output path as a runtime fault, not a usage error', async () => {
      const { code, err } = await invoke(['الرحمن', '--output', '/nope/results.json'], {
        writeFile: () => Promise.reject(new Error('ENOENT')),
      });

      expect(code).toBe(1);
      expect(err).toMatch(/could not write/i);
    });
  });

  describe('output formats', () => {
    it('emits parseable json containing only data', async () => {
      const { code, out } = await invoke(['الرحمن', '--format', 'json']);
      const parsed: unknown = JSON.parse(out);

      expect(code).toBe(0);
      expect(Array.isArray(parsed)).toBe(true);
      expect(out).not.toMatch(/showing/i);
    });

    it('emits csv with the library BOM and header', async () => {
      const { out } = await invoke(['الرحمن', '--format', 'csv']);

      expect(out.startsWith('﻿')).toBe(true);
      expect(out).toContain('sura,aya,score,matchType,text');
    });

    it('emits tab-separated tsv', async () => {
      const { out } = await invoke(['الرحمن', '--format', 'tsv']);

      expect(out).toContain('sura\taya\tscore\tmatchType\ttext');
    });
  });

  describe('--output', () => {
    it('writes the chosen format to the file and leaves stdout empty', async () => {
      const written: { path?: string; contents?: string } = {};

      const { code, out } = await invoke(['الرحمن', '--format', 'csv', '--output', 'r.csv'], {
        writeFile: (path, contents) => {
          written.path = path;
          written.contents = contents;
          return Promise.resolve();
        },
      });

      expect(code).toBe(0);
      expect(out).toBe('');
      expect(written.path).toBe('r.csv');
      expect(written.contents).toContain('sura,aya,score,matchType,text');
    });
  });

  describe('pagination', () => {
    it('returns different verses per page with consistent totals', async () => {
      const first = await invoke(['الرحمن', '--limit', '1', '--page', '1']);
      const second = await invoke(['الرحمن', '--limit', '1', '--page', '2']);

      expect(first.out).not.toBe(second.out);

      const total = (text: string): string => text.match(/of (\d+) results?/)?.[1] ?? '';
      expect(total(first.out)).toBe(total(second.out));
    });

    it('reports no results past the last page, still succeeding', async () => {
      const { code, out } = await invoke(['الرحمن', '--page', '9999']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });
  });

  describe('scope filters', () => {
    // `الرحمن` matches verses in both suras, so these assertions fail if filtering is skipped.
    it('restricts results to one sura', async () => {
      const { code, out } = await invoke(['الرحمن', '--sura', '2']);

      expect(code).toBe(0);
      expect(out).toMatch(/^2:/m);
      expect(out).not.toMatch(/^1:/m);
    });

    it('restricts results to one juz', async () => {
      const { code, out } = await invoke(['الرحمن', '--juz', '2']);

      expect(code).toBe(0);
      expect(out).toMatch(/^2:/m);
      expect(out).not.toMatch(/^1:/m);
    });

    it('combines sura and juz filters', async () => {
      // Sura 1 sits in juz 1, so asking for sura 1 within juz 2 can match nothing.
      const { code, out } = await invoke(['الرحمن', '--sura', '1', '--juz', '2']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });

    it('rejects a sura number that does not exist', async () => {
      const { code, err } = await invoke(['الرحمن', '--sura', '999']);

      expect(code).toBe(2);
      expect(err).toMatch(/1 to 114/);
    });

    it('still succeeds when an in-range scope simply holds nothing', async () => {
      // Sura 1 sits in juz 1, so this combination is legal but empty. An empty corpus would
      // make search() throw MissingDependenciesError, so the CLI answers directly instead.
      const { code, out } = await invoke(['الرحمن', '--sura', '1', '--juz', '2']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });

    it('counts totals within the scope, not across the whole corpus', async () => {
      const all = await invoke(['الرحمن', '--limit', '1']);
      const scoped = await invoke(['الرحمن', '--sura', '2', '--limit', '1']);

      const total = (r: { out: string }): number =>
        Number(r.out.match(/of (\d+) results?/)?.[1] ?? -1);
      expect(total(all)).toBeGreaterThan(total(scoped));
      expect(total(scoped)).toBe(2);
    });
  });

  describe('match breakdown in the table footer', () => {
    it('reports which layers produced the matches', async () => {
      const { out } = await invoke(['الرحمن']);

      expect(out).toMatch(/Matches: /);
      expect(out).toMatch(/exact \d+/);
    });

    it('names the range layer for a coordinate query, without the zeroes', async () => {
      const { out } = await invoke(['1:1-3']);

      expect(out).toContain('range 3');
      expect(out).not.toContain('exact 0');
      expect(out).not.toContain('lemma 0');
    });

    it('says nothing about matches when there are none', async () => {
      const { out } = await invoke(['زقفونة']);

      expect(out).not.toMatch(/Matches: /);
    });

    it('stays out of the machine-readable formats', async () => {
      const { out } = await invoke(['الرحمن', '--format', 'json']);

      expect(out).not.toMatch(/Matches: /);
    });
  });

  describe('warnings', () => {
    it('warns that ignored options have no effect with --regex, then still succeeds', async () => {
      const { code, out, err } = await invoke(['الرحمن', '--regex', '--lemma']);

      expect(code).toBe(0);
      expect(err).toMatch(/^Warning: /);
      expect(err).toContain('--lemma');
      expect(out).not.toBe('');
    });
  });

  describe('bare multiple positionals (combined query)', () => {
    it('requires every term to be present, like a quoted multi-word phrase', async () => {
      // gid 1 and 3 contain both 'الرحمن' and 'الرحيم'; gid 4 and 5 contain only 'الرحمن'.
      // A combined query should keep only the verses matching every term.
      const { code, out } = await invoke(['الرحمن', 'الرحيم', '--no-fuzzy', '--limit', '10']);

      expect(code).toBe(0);
      expect(out).toContain('1:1');
      expect(out).toContain('1:3');
      expect(out).not.toContain('2:1');
      expect(out).not.toContain('2:2');
    });

    it('behaves exactly like quoting the same words together', async () => {
      const bare = await invoke(['الرحمن', 'الرحيم', '--no-fuzzy']);
      const quoted = await invoke(['الرحمن الرحيم', '--no-fuzzy']);

      expect(bare.out).toBe(quoted.out);
    });

    it('rejects a blank argument among several, as a usage error', async () => {
      const { code, err } = await invoke(['الرحمن', '   ']);

      expect(code).toBe(2);
      expect(err).toMatch(/argument 2/i);
    });

    it('does not show multi-term details, since results are plain ScoredVerse', async () => {
      const { out } = await invoke(['الرحمن', 'الرحيم', '--no-fuzzy']);

      expect(out).not.toMatch(/\(\d+ terms? · \d+ hits?\)/);
    });
  });

  describe('array-form queries ([term, term])', () => {
    it('searches each term independently and merges by verse', async () => {
      // '[الرحمن, الرحيم]' matches gids 1, 3, 4, 5 — unlike the bare (AND) form above, gid 4
      // and 5 (only 'الرحمن') are included too, proving the terms ran independently.
      const { code, out } = await invoke(['[الرحمن, الرحيم]', '--no-fuzzy', '--limit', '10']);

      expect(code).toBe(0);
      expect(out).toContain('1:1');
      expect(out).toContain('1:3');
      expect(out).toContain('2:1');
      expect(out).toContain('2:2');
    });

    it('shows the matched-term count and hit count per result', async () => {
      const { out } = await invoke(['[الرحمن, الرحيم]', '--no-fuzzy', '--limit', '10']);

      expect(out).toMatch(/\(\d+ terms? · \d+ hits?\)/);
    });

    it.each(['score', 'coverage', 'frequency'] as const)(
      // Ranking-mode correctness (tiebreaks etc.) is the core layer's job and is already
      // covered in src/core/layers/search-many.test.ts. This just proves --rank-by %s
      // reaches search() without erroring and still renders the merged output.
      'accepts --rank-by %s and still renders merged results',
      async (mode) => {
        const { code, out } = await invoke([
          '[الرحمن, الرحيم]',
          '--rank-by',
          mode,
          '--no-fuzzy',
          '--limit',
          '10',
        ]);

        expect(code).toBe(0);
        expect(out).toMatch(/\(\d+ terms? · \d+ hits?\)/);
      },
    );

    it('rejects a blank term inside the brackets, as a usage error', async () => {
      const { code, err } = await invoke(['[الرحمن,   ]']);

      expect(code).toBe(2);
      expect(err).toMatch(/term 2/i);
    });

    it('includes matchedTerms in json output', async () => {
      const { out } = await invoke(['[الرحمن, الرحيم]', '--no-fuzzy', '--format', 'json']);
      const parsed = JSON.parse(out) as { matchedTerms: string[] }[];

      expect(parsed[0]?.matchedTerms).toBeDefined();
    });

    it('reports no results for an empty array, same as no match', async () => {
      const { code, out } = await invoke(['[]']);

      expect(code).toBe(0);
      expect(out).toMatch(/no results/i);
    });

    it('does not affect --rank-by unless used', async () => {
      const { code, err } = await invoke(['الرحمن', '--rank-by', 'coverage']);

      expect(code).toBe(0);
      expect(err).toMatch(/array form/i);
    });
  });

  describe('stream discipline', () => {
    it('keeps results on stdout and diagnostics on stderr', async () => {
      const ok = await invoke(['الرحمن', '--format', 'json']);
      expect(ok.err).toBe('');

      const bad = await invoke(['رحم', '--nonsense']);
      expect(bad.out).toBe('');
    });
  });
});
