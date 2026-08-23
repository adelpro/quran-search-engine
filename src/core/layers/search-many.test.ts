import { describe, it, expect } from 'vitest';
import { search } from '../search';
import { mergeTermSearches } from './search-many';
import type { QuranText, MorphologyAya, SearchContext, WordMap } from '../../types';

// Four real Al-Fatihah verses, used with lemma/root/fuzzy DISABLED so only the
// exact-substring ("text") layer is active — a verse matches a term iff one of
// its words literally contains that term as a substring. This keeps expected
// matches fully hand-verifiable for these merge-mechanics tests.
const verses: QuranText[] = [
  {
    gid: 1,
    uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    standard: 'بسم الله الرحمن الرحيم',
    sura_id: 1,
    aya_id: 1,
    aya_id_display: '1',
    page_id: 1,
    juz_id: 1,
    standard_full: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 2,
    uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    standard: 'الحمد لله رب العالمين',
    sura_id: 1,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 1,
    juz_id: 1,
    standard_full: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
  {
    gid: 3,
    uthmani: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    standard: 'الرحمن الرحيم',
    sura_id: 1,
    aya_id: 3,
    aya_id_display: '3',
    page_id: 1,
    juz_id: 1,
    standard_full: 'الرَّحْمَنِ الرَّحِيمِ',
    sura_name: 'الفاتحة',
    sura_name_en: 'The Opening',
    sura_name_romanization: 'Al-Fatihah',
  },
];

const context: SearchContext<QuranText> = {
  quranData: new Map(verses.map((v) => [v.gid, v])),
  morphologyMap: new Map(
    verses.map((v): [number, MorphologyAya] => [v.gid, { gid: v.gid, lemmas: [], roots: [] }]),
  ),
  wordMap: new Map() as WordMap,
};

// lemma/root/fuzzy off: only the exact-substring layer can contribute matches.
const exactOnlyOptions = { lemma: false, root: false, fuzzy: false };

describe('mergeTermSearches', () => {
  it('runs a single term through searchFn and adds merge metadata, unchanged otherwise', () => {
    const oracle = search('الله', context, exactOnlyOptions);
    const result = mergeTermSearches(search, ['الله'], context, exactOnlyOptions);

    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe(oracle.results[0].gid);
    expect(result[0].matchScore).toBe(oracle.results[0].matchScore);
    expect(result[0].matchType).toBe(oracle.results[0].matchType);
    expect(result[0].matchedTerms).toEqual(['الله']);
    expect(result[0].distinctTermCount).toBe(1);
    expect(result[0].totalFrequency).toBe(oracle.results[0].matchedTokens.length);
  });

  it('returns the union of independent per-term matches, not an AND-phrase intersection', () => {
    // "الله" alone only appears in gid1; "الحمد" alone only appears in gid2.
    // No verse contains both words, so a combined phrase search finds nothing —
    // proving mergeTermSearches calls searchFn once per term instead of joining
    // the terms into a single "الله الحمد" query.
    const phraseOracle = search('الله الحمد', context, exactOnlyOptions);
    expect(phraseOracle.results).toHaveLength(0);

    const result = mergeTermSearches(search, ['الله', 'الحمد'], context, exactOnlyOptions);
    expect(result.map((r) => r.gid).sort()).toEqual([1, 2]);
  });

  it('merges a verse matched by multiple terms, accumulating matchScore/totalFrequency', () => {
    // "الله" matches gid1 only; "الرحمن" matches gid1 and gid3.
    const result = mergeTermSearches(search, ['الله', 'الرحمن'], context, exactOnlyOptions);

    const gid1 = result.find((r) => r.gid === 1);
    const gid3 = result.find((r) => r.gid === 3);

    expect(result).toHaveLength(2);
    expect(gid1?.matchedTerms.sort()).toEqual(['الرحمن', 'الله']);
    expect(gid1?.distinctTermCount).toBe(2);
    expect(gid1?.matchScore).toBe(6); // 3 (from "الله") + 3 (from "الرحمن")
    expect(gid1?.totalFrequency).toBe(2);

    expect(gid3?.matchedTerms).toEqual(['الرحمن']);
    expect(gid3?.distinctTermCount).toBe(1);
    expect(gid3?.matchScore).toBe(3);
  });

  it('treats a duplicate input term as one distinct term, but still accumulates its score/frequency', () => {
    const result = mergeTermSearches(search, ['الله', 'الله'], context, exactOnlyOptions);

    expect(result).toHaveLength(1);
    expect(result[0].matchedTerms).toEqual(['الله']); // deduplicated, not ['الله', 'الله']
    expect(result[0].distinctTermCount).toBe(1); // coverage does NOT double-count a repeated term
    expect(result[0].matchScore).toBe(6); // score DOES accumulate: 3 + 3, one per searchFn call
    expect(result[0].totalFrequency).toBe(2);
  });

  it('returns an empty array when none of the terms match anything', () => {
    const result = mergeTermSearches(search, ['كلمةغيرموجودة'], context, exactOnlyOptions);
    expect(result).toEqual([]);
  });

  it('does not sort or paginate — ranking is the orchestrator’s job', () => {
    // All three terms hit disjoint verses at an equal score, so the array should
    // come back in first-inserted order (gid1, then gid3, then gid2) rather than
    // sorted by any ranking criterion.
    const result = mergeTermSearches(
      search,
      ['الله', 'الرحمن', 'الحمد'],
      context,
      exactOnlyOptions,
    );
    expect(result.map((r) => r.gid)).toEqual([1, 3, 2]);
  });
});

// ---------------------------------------------------------------------------
// search() — the orchestrator in core/search.ts that wraps mergeTermSearches
// with validation, rankBy sorting, pagination, and counts. Everything above this
// point tests the layer in isolation; everything below tests what only the
// orchestrator itself adds.
// ---------------------------------------------------------------------------

// Three synthetic verses engineered so score / coverage / frequency rankings
// each pick a DIFFERENT verse as their top result:
//   gid 101 - one term hits via exact+lemma+root all at once  -> score 6, coverage 1, freq 1
//   gid 102 - two different terms each hit via root only      -> score 2, coverage 2, freq 2
//   gid 103 - one term's substring hits three different words -> score 3, coverage 1, freq 3
const rankingVerses: QuranText[] = [
  {
    gid: 101,
    uthmani: 'الحكيم العليم',
    standard: 'الحكيم العليم',
    sura_id: 999,
    aya_id: 1,
    aya_id_display: '1',
    page_id: 1,
    juz_id: 1,
    standard_full: 'الحكيم العليم',
    sura_name: 'اختبار',
    sura_name_en: 'Test',
    sura_name_romanization: 'Ikhtibar',
  },
  {
    gid: 102,
    uthmani: 'رحمة قدرة',
    standard: 'رحمة قدرة',
    sura_id: 999,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 1,
    juz_id: 1,
    standard_full: 'رحمة قدرة',
    sura_name: 'اختبار',
    sura_name_en: 'Test',
    sura_name_romanization: 'Ikhtibar',
  },
  {
    gid: 103,
    uthmani: 'نور منور نوراني',
    standard: 'نور منور نوراني',
    sura_id: 999,
    aya_id: 3,
    aya_id_display: '3',
    page_id: 1,
    juz_id: 1,
    standard_full: 'نور منور نوراني',
    sura_name: 'اختبار',
    sura_name_en: 'Test',
    sura_name_romanization: 'Ikhtibar',
  },
];

const rankingContext: SearchContext<QuranText> = {
  quranData: new Map(rankingVerses.map((v) => [v.gid, v])),
  morphologyMap: new Map<number, MorphologyAya>([
    [101, { gid: 101, lemmas: [], roots: [] }],
    // roots populated so the linguistic-search candidate stage can find gid102
    // via root lookup even though neither term appears verbatim in its text.
    [102, { gid: 102, lemmas: [], roots: ['ر ح م', 'ق د ر'] }],
    [103, { gid: 103, lemmas: [], roots: [] }],
  ]),
  wordMap: new Map(
    Object.entries({
      العليم: { lemma: 'علم', root: 'ع ل م' },
      رحيم: { root: 'ر ح م' },
      قدير: { root: 'ق د ر' },
    }),
  ) as WordMap,
};

const rankingTerms = ['العليم', 'رحيم', 'قدير', 'نور'];
const rankingOptions = { lemma: true, root: true, fuzzy: false };

// Two verses that TIE on totalFrequency (2) but differ in matchScore, built
// entirely from the exact-match layer:
//   gid201 - ONE term's substring hits two different words -> score 3, freq 2
//   gid202 - TWO different terms each hit one word          -> score 6, freq 2
// Used to prove 'frequency' ranking falls back to matchScore when its primary
// metric ties. (A 'coverage' tie can't be built the same way: under exact-only
// matching every contributing term adds a flat +3, so matchScore is always
// exactly 3 * distinctTermCount — two verses can never tie on distinctTermCount
// while differing in matchScore unless lemma/root scoring also contributes.)
const tieVerses: QuranText[] = [
  {
    gid: 201,
    uthmani: 'نور منور',
    standard: 'نور منور',
    sura_id: 999,
    aya_id: 1,
    aya_id_display: '1',
    page_id: 1,
    juz_id: 1,
    standard_full: 'نور منور',
    sura_name: 'اختبار',
    sura_name_en: 'Test',
    sura_name_romanization: 'Ikhtibar',
  },
  {
    gid: 202,
    uthmani: 'العليم الحكيم',
    standard: 'العليم الحكيم',
    sura_id: 999,
    aya_id: 2,
    aya_id_display: '2',
    page_id: 1,
    juz_id: 1,
    standard_full: 'العليم الحكيم',
    sura_name: 'اختبار',
    sura_name_en: 'Test',
    sura_name_romanization: 'Ikhtibar',
  },
];

const tieContext: SearchContext<QuranText> = {
  quranData: new Map(tieVerses.map((v) => [v.gid, v])),
  morphologyMap: new Map(
    tieVerses.map((v): [number, MorphologyAya] => [v.gid, { gid: v.gid, lemmas: [], roots: [] }]),
  ),
  wordMap: new Map() as WordMap,
};

const tieTerms = ['نور', 'العليم', 'الحكيم'];

// Reuses fixture3's lemma/root/semantic morphology from search.test.ts, to
// prove search() reuses the *full* search() pipeline unmodified.
const pipelineContext: SearchContext<QuranText> = {
  quranData: new Map(verses.map((v) => [v.gid, v])),
  morphologyMap: new Map<number, MorphologyAya>([
    [
      1,
      {
        gid: 1,
        lemmas: ['بسم', 'الله', 'الرحمن', 'الرحيم'],
        roots: ['ب س م', 'ا ل ه', 'ر ح م', 'ر ح م'],
      },
    ],
    [
      2,
      {
        gid: 2,
        lemmas: ['الحمد', 'لله', 'رب', 'العالمين'],
        roots: ['ح م د', 'ا ل ه', 'ر ب ب', 'ع ل م'],
      },
    ],
    [3, { gid: 3, lemmas: ['الرحمن', 'الرحيم'], roots: ['ر ح م', 'ر ح م'] }],
  ]),
  wordMap: new Map(
    Object.entries({
      الله: { lemma: 'الله', root: 'ا ل ه' },
      الرحمن: { lemma: 'الرحمن', root: 'ر ح م' },
      الحمد: { lemma: 'الحمد', root: 'ح م د' },
    }),
  ) as WordMap,
};

describe('search() — array overload (multi-term)', () => {
  describe('orchestrator behavior', () => {
    it('returns empty results when none of the terms match anything', () => {
      const result = search(['كلمةغيرموجودة'], context, exactOnlyOptions);

      expect(result.results).toEqual([]);
      expect(result.counts.total).toBe(0);
      expect(result.pagination).toEqual({
        totalResults: 0,
        totalPages: 0,
        currentPage: 1,
        limit: 20,
      });
    });

    it('paginates the merged, ranked result set', () => {
      // "الرحمن" -> gid1, gid3 | "الحمد" -> gid2 | "الدين" -> gid4 (not in this
      // fixture, so use only the first three verses' terms). No overlaps, so
      // all matched verses tie at matchScore 3 and are paginated one per page
      // in the order they were first inserted into the merge map.
      const terms = ['الرحمن', 'الحمد'];

      const page1 = search(terms, context, exactOnlyOptions, { page: 1, limit: 1 });
      const page2 = search(terms, context, exactOnlyOptions, { page: 2, limit: 1 });

      expect(page1.results).toHaveLength(1);
      expect(page2.results).toHaveLength(1);
      expect(page1.results[0].gid).not.toBe(page2.results[0].gid);
      expect(page1.pagination).toEqual({
        totalResults: 3,
        totalPages: 3,
        currentPage: 1,
        limit: 1,
      });
      expect(page2.pagination.currentPage).toBe(2);
    });

    it('computes counts from the full merged set, tallied by matchType', () => {
      const result = search(['الله', 'الرحمن'], context, exactOnlyOptions);

      expect(result.counts).toEqual({
        simple: 2, // gid1 and gid3, both matchType 'exact'
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: 0,
        range: 0,
        total: 2,
      });
    });
  });

  describe('ranking modes', () => {
    it('rankBy "score" orders by accumulated matchScore', () => {
      const result = search(rankingTerms, rankingContext, rankingOptions, {
        rankBy: 'score',
      });
      expect(result.results[0].gid).toBe(101);
    });

    it('rankBy "coverage" orders by number of distinct matched terms', () => {
      const result = search(rankingTerms, rankingContext, rankingOptions, {
        rankBy: 'coverage',
      });
      expect(result.results[0].gid).toBe(102);
    });

    it('rankBy "frequency" orders by total raw hit count', () => {
      const result = search(rankingTerms, rankingContext, rankingOptions, {
        rankBy: 'frequency',
      });
      expect(result.results[0].gid).toBe(103);
    });

    it('defaults to "score" ranking when rankBy is omitted', () => {
      const withDefault = search(rankingTerms, rankingContext, rankingOptions);
      const withExplicitScore = search(rankingTerms, rankingContext, rankingOptions, {
        rankBy: 'score',
      });
      expect(withDefault.results.map((r) => r.gid)).toEqual(
        withExplicitScore.results.map((r) => r.gid),
      );
    });

    it('rankBy "frequency" falls back to matchScore when totalFrequency ties', () => {
      const result = search(tieTerms, tieContext, exactOnlyOptions, { rankBy: 'frequency' });

      // Both verses accumulate exactly 2 hits — a genuine tie on the primary key.
      expect(result.results.map((r) => r.totalFrequency)).toEqual([2, 2]);
      // gid202 (matchScore 6, two exact terms) outranks gid201 (matchScore 3,
      // one term hitting two words) purely via the matchScore tiebreak.
      expect(result.results.map((r) => r.gid)).toEqual([202, 201]);
      expect(result.results.map((r) => r.matchScore)).toEqual([6, 3]);
    });

    it('rankBy "score" has no secondary tiebreak — equal scores keep merge order', () => {
      // "الرحمن" -> gid1, gid3 | "الحمد" -> gid2. No verse is matched by more
      // than one term, so all three tie at matchScore 3. With no tiebreak,
      // order follows first-inserted-into-the-merge-map order.
      const terms = ['الرحمن', 'الحمد'];
      const result = search(terms, context, exactOnlyOptions, { rankBy: 'score', limit: 10 });

      expect(result.results.map((r) => r.matchScore)).toEqual([3, 3, 3]);
      expect(result.results.map((r) => r.gid)).toEqual([1, 3, 2]);
    });
  });

  describe('pipeline reuse (lemma/root/semantic)', () => {
    it('reuses lemma/root matching exactly like a direct search() call', () => {
      const options = { lemma: true, root: true };
      const oracle = search('الرحمن', pipelineContext, options);
      const result = search(['الرحمن'], pipelineContext, options);

      expect(result.results.map((r) => r.gid).sort()).toEqual(
        oracle.results.map((r) => r.gid).sort(),
      );
      for (const oracleVerse of oracle.results) {
        const merged = result.results.find((r) => r.gid === oracleVerse.gid);
        expect(merged?.matchScore).toBe(oracleVerse.matchScore);
        expect(merged?.matchType).toBe(oracleVerse.matchType);
      }
    });

    it('reuses semantic search exactly like a direct search() call', () => {
      const options = { lemma: true, root: true, semantic: true };
      const oracle = search('الرحمن', pipelineContext, options);
      const result = search(['الرحمن'], pipelineContext, options);

      expect(result.results.map((r) => r.gid).sort()).toEqual(
        oracle.results.map((r) => r.gid).sort(),
      );
    });

    it('reuses range-query shortcut per term, and tallies it correctly in counts', () => {
      // "1:3" is a range query (aya 3 of sura 1 = gid3), taking search()'s range
      // shortcut for that one term. It should merge like any other term's match,
      // and — unlike the string overload's own counts, which structurally can never
      // see a 'range' matchType — the array overload's counts must actually count it
      // here, since it comes from one of several independent per-term search() calls.
      const result = search(['1:3'], context, exactOnlyOptions);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].gid).toBe(3);
      expect(result.results[0].matchType).toBe('range');
      expect(result.results[0].matchedTerms).toEqual(['1:3']);
      expect(result.counts).toEqual({
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: 0,
        range: 1,
        total: 1,
      });
    });

    it('reuses the regex shortcut per term, and tallies it correctly in counts', () => {
      // options.isRegex applies to every term in this call (it's one shared
      // options object forwarded per-term), so "^الرحمن" is compiled as a regex
      // and matched against verse.standard directly.
      const result = search(['^الرحمن'], context, {
        lemma: false,
        root: false,
        isRegex: true,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].gid).toBe(3); // "الرحمن الرحيم" starts with "الرحمن"
      expect(result.results[0].matchType).toBe('regex');
      expect(result.counts).toEqual({
        simple: 0,
        lemma: 0,
        root: 0,
        fuzzy: 0,
        semantic: 0,
        regex: 1,
        range: 0,
        total: 1,
      });
    });

    it('reuses boolean-operator parsing within a single term', () => {
      // A single term can itself carry boolean syntax: "+الله -الرحمن" requires
      // "الله" and excludes "الرحمن", both evaluated within that one search() call.
      const booleanVerses: QuranText[] = [
        {
          gid: 301,
          uthmani: 'اللَّهُ كَرِيمٌ',
          standard: 'الله كريم',
          sura_id: 999,
          aya_id: 1,
          aya_id_display: '1',
          page_id: 1,
          juz_id: 1,
          standard_full: 'الله كريم',
          sura_name: 'اختبار',
          sura_name_en: 'Test',
          sura_name_romanization: 'Ikhtibar',
        },
        {
          gid: 302,
          uthmani: 'الرَّحْمَٰنُ كَرِيمٌ',
          standard: 'الرحمن كريم',
          sura_id: 999,
          aya_id: 2,
          aya_id_display: '2',
          page_id: 1,
          juz_id: 1,
          standard_full: 'الرحمن كريم',
          sura_name: 'اختبار',
          sura_name_en: 'Test',
          sura_name_romanization: 'Ikhtibar',
        },
      ];
      const booleanContext: SearchContext<QuranText> = {
        quranData: new Map(booleanVerses.map((v) => [v.gid, v])),
        morphologyMap: new Map(
          booleanVerses.map((v): [number, MorphologyAya] => [
            v.gid,
            { gid: v.gid, lemmas: [], roots: [] },
          ]),
        ),
        wordMap: new Map() as WordMap,
      };

      const result = search(['+الله -الرحمن'], booleanContext, exactOnlyOptions);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].gid).toBe(301); // has "الله", excludes "الرحمن"
      expect(result.results[0].matchType).toBe('exact'); // boolean filters the set; scoring is normal
    });
  });
});
