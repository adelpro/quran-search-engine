import { describe, expect, it } from 'vitest';
import type { QuranText, ScoredVerse, SearchResponse } from '../types';
import { formatResults, formatTable, helpText } from './format';

const verse = (sura: number, aya: number, standard: string): ScoredVerse<QuranText> => ({
  gid: aya,
  sura_id: sura,
  aya_id: aya,
  aya_id_display: String(aya),
  uthmani: standard,
  standard,
  standard_full: standard,
  page_id: 1,
  juz_id: 1,
  sura_name: 'الفاتحة',
  sura_name_en: 'The Opening',
  sura_name_romanization: 'Al-Fatihah',
  matchScore: 3,
  matchType: 'exact',
  matchedTokens: [],
});

const response = (
  results: ScoredVerse<QuranText>[],
  totalResults = results.length,
  currentPage = 1,
  limit = 20,
): SearchResponse<QuranText> => ({
  results,
  counts: {
    simple: results.length,
    lemma: 0,
    root: 0,
    fuzzy: 0,
    range: 0,
    semantic: 0,
    regex: 0,
    total: totalResults,
  },
  pagination: {
    totalResults,
    totalPages: Math.max(1, Math.ceil(totalResults / limit)),
    currentPage,
    limit,
  },
});

describe('formatTable', () => {
  it('renders each verse with its sura and aya reference and text', () => {
    const output = formatTable(
      response([verse(1, 1, 'بسم الله'), verse(1, 2, 'الحمد لله')]),
      'الله',
    );

    expect(output).toContain('1:1  بسم الله');
    expect(output).toContain('1:2  الحمد لله');
  });

  it('reports the totals so the reader knows what is unseen', () => {
    const output = formatTable(response([verse(2, 255, 'الله')], 313, 1, 20), 'الله');

    expect(output).toContain('313');
    expect(output).toMatch(/page 1 of 16/);
  });

  it('states there are no results rather than printing nothing', () => {
    // Exit code 0 alone cannot distinguish "no matches" from a blank success, so the
    // message has to be explicit.
    const output = formatTable(response([], 0), 'زقفونة');

    expect(output.trim()).toBe('No results for "زقفونة".');
  });

  it('uses the singular for a single result', () => {
    expect(formatTable(response([verse(1, 1, 'بسم الله')], 1), 'بسم')).toMatch(/1 result\b/);
  });

  it('always ends with a newline', () => {
    expect(formatTable(response([verse(1, 1, 'بسم')]), 'بسم').endsWith('\n')).toBe(true);
    expect(formatTable(response([], 0), 'x').endsWith('\n')).toBe(true);
  });
});

describe('formatResults', () => {
  it('delegates json to the library exporter without decoration', () => {
    const output = formatResults(response([verse(1, 1, 'بسم الله')]), 'json', 'بسم');
    const parsed: unknown = JSON.parse(output);

    expect(Array.isArray(parsed)).toBe(true);
    expect(output).not.toContain('Showing');
  });

  it('delegates csv to the library exporter, preserving its BOM and header', () => {
    const output = formatResults(response([verse(1, 1, 'بسم الله')]), 'csv', 'بسم');

    expect(output.startsWith('﻿')).toBe(true);
    expect(output).toContain('sura,aya,score,matchType,text');
  });

  it('delegates tsv with tab separators', () => {
    const output = formatResults(response([verse(1, 1, 'بسم الله')]), 'tsv', 'بسم');

    expect(output).toContain('sura\taya\tscore\tmatchType\ttext');
  });

  it('renders the table when no machine format is requested', () => {
    expect(formatResults(response([verse(1, 1, 'بسم الله')]), 'table', 'بسم')).toContain('1:1');
  });
});

describe('helpText', () => {
  it('lists every option with its default', () => {
    const help = helpText();

    for (const flag of [
      '--lemma',
      '--no-lemma',
      '--root',
      '--no-root',
      '--fuzzy',
      '--no-fuzzy',
      '--semantic',
      '--regex',
      '--sura',
      '--juz',
      '--page',
      '--limit',
      '--format',
      '--output',
      '--help',
      '--version',
    ]) {
      expect(help).toContain(flag);
    }

    expect(help).toMatch(/default: on/);
    expect(help).toMatch(/default: off/);
    expect(help).toMatch(/default: 1\b/);
    expect(help).toMatch(/default: 20\b/);
  });

  it('says which query shapes need no flag', () => {
    const help = helpText();

    expect(help).toMatch(/2:255/);
    expect(help).toMatch(/Logical operators/i);
    expect(help).toMatch(/Transliteration/i);
  });

  it('states the valid range for the scope filters', () => {
    const help = helpText();

    expect(help).toMatch(/--sura .*1 to 114/);
    expect(help).toMatch(/--juz .*1 to 30/);
  });

  it('mentions that options accept --flag=value too', () => {
    expect(helpText()).toMatch(/--limit=5/);
  });

  it('documents the three exit codes', () => {
    const help = helpText();

    expect(help).toMatch(/0\s+completed/i);
    expect(help).toMatch(/1\s+runtime error/i);
    expect(help).toMatch(/2\s+invalid usage/i);
  });
});
