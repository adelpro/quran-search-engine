import { describe, it, expect } from 'vitest';
import { search } from '../search';
import { performSubjectSearch } from './subject-search';
import { buildInvertedIndex } from '../../utils/loader';
import type { QuranText, MorphologyAya, ScoredVerse } from '../../types';

const mockQuranData: QuranText[] = [
  {
    gid: 1,
    uthmani: 'وَأَنزَلْنَا مِنَ ٱلسَّمَآءِ مَآءً',
    standard: 'وانزلنا من السماء ماء',
    sura_id: 23,
    aya_id: 18,
    aya_id_display: '18',
    page_id: 342,
    juz_id: 18,
    standard_full: 'وَأَنزَلْنَا مِنَ السَّمَاءِ مَاءً',
    sura_name: 'المؤمنون',
    sura_name_en: 'The Believers',
    sura_name_romanization: 'Al-Muminun',
  },
  {
    gid: 2,
    uthmani: 'وَأَرْسَلْنَا ٱلرِّيَٰحَ لَوَٰقِحَ',
    standard: 'وارسلنا الرياح لواقح',
    sura_id: 15,
    aya_id: 22,
    aya_id_display: '22',
    page_id: 262,
    juz_id: 14,
    standard_full: 'وَأَرْسَلْنَا الرِّيَاحَ لَوَاقِحَ',
    sura_name: 'الحجر',
    sura_name_en: 'The Rocky Tract',
    sura_name_romanization: 'Al-Hijr',
  },
  {
    gid: 3,
    uthmani: 'وَلِلَّهِ مَا فِي ٱلسَّمَٰوَٰتِ وَمَا فِي ٱلْأَرْضِ',
    standard: 'ولله ما في السماوات وما في الارض',
    sura_id: 2,
    aya_id: 284,
    aya_id_display: '284',
    page_id: 48,
    juz_id: 3,
    standard_full: 'وَلِلَّهِ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ',
    sura_name: 'البقرة',
    sura_name_en: 'The Cow',
    sura_name_romanization: 'Al-Baqarah',
  },
];

const mockQuranDataMap = new Map(mockQuranData.map((v) => [v.gid, v]));

// Subject matching resolves through roots and lemmas, so the fixtures carry the same shape
// of morphology the real data does. gid 4 is the interesting one: its only rain token is the
// prefixed verb وامطرنا, reachable from the bare word مطر solely through the shared root.
const mockMorphologyMap = new Map<number, MorphologyAya>([
  [1, { gid: 1, lemmas: ['سماء', 'ماء'], roots: ['س-م-و', 'م-و-ه'] }],
  [2, { gid: 2, lemmas: ['ريح'], roots: ['ر-و-ح'] }],
  [3, { gid: 3, lemmas: ['سماء', 'ارض'], roots: ['س-م-و', 'ا-ر-ض'] }],
  [4, { gid: 4, lemmas: ['مطر'], roots: ['م-ط-ر'] }],
]);

const mockWordMap = new Map<string, { lemma?: string; root?: string }>([
  ['ماء', { lemma: 'ماء', root: 'م-و-ه' }],
  ['رياح', { lemma: 'ريح', root: 'ر-و-ح' }],
  ['ريح', { lemma: 'ريح', root: 'ر-و-ح' }],
  ['مطر', { lemma: 'مطر', root: 'م-ط-ر' }],
  ['سحاب', { lemma: 'سحاب', root: 'س-ح-ب' }],
]);

// Subject map: "weather" → Arabic weather-related words
const mockSubjectMap = new Map<string, string[]>([
  ['weather', ['ماء', 'رياح', 'سحاب', 'مطر', 'برق', 'رعد']],
  ['climate', ['ماء', 'رياح', 'سحاب', 'مطر', 'برق', 'رعد']],
  ['rain', ['ماء', 'مطر', 'غيث']],
  ['wind', ['رياح', 'ريح']],
]);

describe('Subject Search', () => {
  it('should find verses by English subject keyword (climate)', () => {
    const result = search(
      'climate',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: true },
    );

    const gids = result.results.map((r: ScoredVerse) => r.gid);
    // gid 1 has ماء, gid 2 has رياح — both are in the weather subject
    expect(gids).toContain(1);
    expect(gids).toContain(2);
    expect(result.counts.subject).toBeGreaterThan(0);
  });

  it('should find verses by English subject keyword (weather)', () => {
    const result = search(
      'weather',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: true },
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.counts.subject).toBeGreaterThan(0);
  });

  it('should return empty when subject option is false', () => {
    const result = search(
      'climate',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: false },
    );

    const subjectResults = result.results.filter((r) => r.matchType === 'subject');
    expect(subjectResults).toHaveLength(0);
  });

  it('should return empty when no subjectMap is provided', () => {
    const result = search(
      'climate',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
      },
      { lemma: false, root: false, subject: true },
    );

    const subjectResults = result.results.filter((r) => r.matchType === 'subject');
    expect(subjectResults).toHaveLength(0);
  });

  it('should return subject matchType on matched verses', () => {
    const result = search(
      'rain',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: true },
    );

    const subjectResults = result.results.filter((r) => r.matchType === 'subject');
    expect(subjectResults.length).toBeGreaterThan(0);
    subjectResults.forEach((r) => {
      expect(r.matchedTokens.length).toBeGreaterThan(0);
      expect(r.matchScore).toBeGreaterThan(0);
    });
  });

  it('should not find unrelated verse (gid 3) when searching for weather', () => {
    const result = search(
      'weather',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: true },
    );

    const gids = result.results.map((r) => r.gid);
    // gid 3 only has سماوات/ارض — not in the weather subject map
    expect(gids).not.toContain(3);
  });
});

describe('Subject Search — fuzzy English fallback (#119)', () => {
  const searchSubject = (query: string) =>
    search(
      query,
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
      },
      { lemma: false, root: false, subject: true },
    ).results.filter((r: ScoredVerse) => r.matchType === 'subject');

  it('resolves a misspelled English key to the same theme as the correct spelling', () => {
    const correct = searchSubject('rain')
      .map((r) => r.gid)
      .sort();
    const typo = searchSubject('rrain')
      .map((r) => r.gid)
      .sort();

    expect(typo).toEqual(correct);
    expect(typo.length).toBeGreaterThan(0);
  });

  it('resolves a second misspelling to its own theme (climte → climate)', () => {
    const correct = searchSubject('climate')
      .map((r) => r.gid)
      .sort();
    const typo = searchSubject('climte')
      .map((r) => r.gid)
      .sort();

    expect(typo).toEqual(correct);
    expect(typo.length).toBeGreaterThan(0);
  });

  it('leaves exact matches untouched', () => {
    // Same assertions the original exact-match test made — fuzzy is a fallback, not a
    // replacement, so an exact key must still resolve without going anywhere near Fuse.
    expect(searchSubject('rain').length).toBeGreaterThan(0);
  });

  it('does not fuzzy-match a word unrelated to any theme', () => {
    expect(searchSubject('xyzabc')).toHaveLength(0);
  });

  it('keeps indexed and scan paths identical for a misspelled query', () => {
    const invertedIndex = buildInvertedIndex(
      mockMorphologyMap,
      mockQuranDataMap,
      undefined,
      mockSubjectMap,
      mockWordMap,
    );

    const withIndex = search(
      'rrain',
      {
        quranData: mockQuranDataMap,
        morphologyMap: mockMorphologyMap,
        wordMap: mockWordMap,
        subjectMap: mockSubjectMap,
        invertedIndex,
      },
      { lemma: false, root: false, subject: true },
    )
      .results.filter((r: ScoredVerse) => r.matchType === 'subject')
      .map((r) => r.gid)
      .sort();

    const withoutIndex = searchSubject('rrain')
      .map((r) => r.gid)
      .sort();

    expect(withIndex).toEqual(withoutIndex);
  });
});

// gid 4 carries the prefixed form وامطرنا — a different whitespace-delimited token than the
// bare subject word مطر, and reachable only through the root they share. It is the case
// where an exact wordIndex lookup and a substring scan used to disagree.
const parityVerse: QuranText = {
  gid: 4,
  uthmani: 'وَأَمْطَرْنَا عَلَيْهِم مَّطَرًا',
  standard: 'وامطرنا عليهم مطرا',
  sura_id: 7,
  aya_id: 84,
  aya_id_display: '84',
  page_id: 161,
  juz_id: 8,
  standard_full: 'وَأَمْطَرْنَا عَلَيْهِمْ مَطَرًا',
  sura_name: 'الأعراف',
  sura_name_en: 'The Heights',
  sura_name_romanization: 'Al-Araf',
};

const parityData = new Map([...mockQuranData, parityVerse].map((v) => [v.gid, v]));
const parityInvertedIndex = buildInvertedIndex(
  mockMorphologyMap,
  parityData,
  undefined,
  mockSubjectMap,
  mockWordMap,
);

const gidsFor = (query: string, withIndex: boolean): number[] =>
  search(
    query,
    {
      quranData: parityData,
      morphologyMap: mockMorphologyMap,
      wordMap: mockWordMap,
      subjectMap: mockSubjectMap,
      ...(withIndex ? { invertedIndex: parityInvertedIndex } : {}),
    },
    { lemma: false, root: false, subject: true },
  )
    .results.filter((r: ScoredVerse) => r.matchType === 'subject')
    .map((r: ScoredVerse) => r.gid)
    .sort((a, b) => a - b);

// Direct Arabic is exercised at the layer boundary: the full pipeline hands such a
// query to the exact layer first, so the verse never reaches the result set tagged
// as a subject match.
const layerGids = (query: string, withIndex: boolean): number[] =>
  performSubjectSearch(
    query,
    parityData,
    { lemma: false, root: false, subject: true },
    mockSubjectMap,
    query,
    withIndex ? parityInvertedIndex : undefined,
    mockWordMap,
    mockMorphologyMap,
  )
    .map((r) => r.gid)
    .sort((a, b) => a - b);

describe('Subject Search — indexed/scan parity (search pipeline)', () => {
  it.each(['climate', 'weather', 'rain', 'wind'])(
    'returns identical results with and without invertedIndex for "%s"',
    (query) => {
      expect(gidsFor(query, true)).toEqual(gidsFor(query, false));
    },
  );

  it('resolves a subject whose words only appear in prefixed form on both paths', () => {
    expect(gidsFor('rain', false)).toContain(4);
    expect(gidsFor('rain', true)).toContain(4);
  });
});

describe('Subject Search — indexed/scan parity (layer)', () => {
  it('matches the prefixed form وامطرنا for the bare Arabic word مطر on both paths', () => {
    expect(layerGids('مطر', false)).toContain(4);
    expect(layerGids('مطر', true)).toContain(4);
    expect(layerGids('مطر', true)).toEqual(layerGids('مطر', false));
  });

  it.each(['climate', 'weather', 'rain', 'wind', 'مطر', 'رياح', 'ماء'])(
    'layer results are identical with and without invertedIndex for "%s"',
    (query) => {
      expect(layerGids(query, true)).toEqual(layerGids(query, false));
    },
  );
});

// Issue #117: buildSubjectMap now registers each Arabic word as a key resolving to its own
// theme's word list (see src/utils/loader.ts), not just English aliases. This mirrors that
// shape by pointing مطر/غيث at the same group as their English alias 'rain', and ريح at the
// same group as 'wind' — exactly what addWords(arWord, normalizedArabic) produces in loader.ts.
const mockSubjectMapV2 = new Map(mockSubjectMap);
mockSubjectMapV2.set('مطر', mockSubjectMap.get('rain')!);
mockSubjectMapV2.set('غيث', mockSubjectMap.get('rain')!);
mockSubjectMapV2.set('ريح', mockSubjectMap.get('wind')!);

const v2InvertedIndex = buildInvertedIndex(
  mockMorphologyMap,
  parityData,
  undefined,
  mockSubjectMapV2,
  mockWordMap,
);

describe('Subject Search v2 — Arabic word opens its theme', () => {
  it('resolves an Arabic theme word the same as its English alias', () => {
    const arabicHits = performSubjectSearch(
      'مطر',
      parityData,
      { lemma: false, root: false, subject: true },
      mockSubjectMapV2,
      'مطر',
    )
      .map((r) => r.gid)
      .sort((a, b) => a - b);

    const englishHits = performSubjectSearch(
      'rain',
      parityData,
      { lemma: false, root: false, subject: true },
      mockSubjectMapV2,
      'rain',
    )
      .map((r) => r.gid)
      .sort((a, b) => a - b);

    expect(arabicHits).toEqual(englishHits);
    expect(arabicHits.length).toBeGreaterThan(0);
  });

  // subjectIndex is a projection of subjectMap — it should reflect the new Arabic keys with
  // no extra build step, so a direct lookup agrees with running the layer's own resolution.
  it('keeps subjectIndex in sync with the layer for a newly-registered Arabic key', () => {
    const layerHits = performSubjectSearch(
      'مطر',
      parityData,
      { lemma: false, root: false, subject: true },
      mockSubjectMapV2,
      'مطر',
      v2InvertedIndex,
      mockWordMap,
      mockMorphologyMap,
    )
      .map((r) => r.gid)
      .sort((a, b) => a - b);

    const indexedGids = Array.from(v2InvertedIndex.subjectIndex?.get('مطر') ?? []).sort(
      (a, b) => a - b,
    );

    expect(indexedGids).toEqual(layerHits);
    expect(indexedGids.length).toBeGreaterThan(0);
  });
});

describe('Subject Search — stem precision', () => {
  // Substring containment used to be the matching rule, which meant a subject word matched
  // anywhere inside a longer, unrelated stem. These are the cases that regressed worst.
  it('does not match ماء inside السماء', () => {
    const gids = performSubjectSearch(
      'rain',
      mockQuranDataMap,
      { lemma: false, root: false, subject: true },
      mockSubjectMap,
      'rain',
      undefined,
      mockWordMap,
      mockMorphologyMap,
    ).map((r) => r.gid);

    // gid 3 contains السماوات and الارض but no standalone water token.
    expect(gids).not.toContain(3);
  });

  it('matches رياح through its definite-article form الرياح', () => {
    const result = performSubjectSearch(
      'wind',
      mockQuranDataMap,
      { lemma: false, root: false, subject: true },
      mockSubjectMap,
      'wind',
      undefined,
      mockWordMap,
      mockMorphologyMap,
    );

    expect(result.map((r) => r.gid)).toContain(2);
    expect(result.find((r) => r.gid === 2)?.matchedTokens).toContain('رياح');
  });

  it('reports only the subject words that actually matched the verse', () => {
    const result = performSubjectSearch(
      'weather',
      mockQuranDataMap,
      { lemma: false, root: false, subject: true },
      mockSubjectMap,
      'weather',
      undefined,
      mockWordMap,
      mockMorphologyMap,
    );

    const verse = result.find((r) => r.gid === 2);
    expect(verse?.matchedTokens).toEqual(['رياح']);
    expect(verse?.matchScore).toBe(4);
  });
});
