import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadPhoneticData,
  loadSubjectData,
  buildInvertedIndex,
  search,
  createArabicFuseSearch,
  LRUCache,
  hasBooleanOperators,
  clearBooleanOperators,
  exportResults,
  getHighlightRanges,
  validateRegex,
  normalizeArabic,
  SURAS,
} from 'quran-search-engine';

const SEPARATOR = '─'.repeat(50);

function printCounts(counts) {
  const labels = ['simple', 'lemma', 'root', 'fuzzy', 'semantic', 'subject', 'regex', 'range'];
  const parts = labels.filter((key) => counts[key] > 0).map((key) => `${key} ${counts[key]}`);
  console.log(
    `   Counts: ${parts.length > 0 ? parts.join(' · ') : 'none'} · total ${counts.total}`,
  );
}

function printResults(label, response, limit = 3) {
  console.log(`🔍 ${label}`);
  console.log(SEPARATOR);
  console.log(`📊 Found ${response.pagination.totalResults} matches`);
  printCounts(response.counts);
  response.results.slice(0, limit).forEach((verse, index) => {
    const terms = verse.matchedTerms ? ` — terms: ${verse.matchedTerms.join(', ')}` : '';
    console.log(
      `   ${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id}) — ${verse.matchType}${terms}`,
    );
    console.log(`      ${verse.uthmani}`);
  });
  console.log(SEPARATOR);
  console.log();
}

async function main() {
  console.log('🚀 Loading Quran Search Engine data...\n');

  try {
    const [quranData, morphologyMap, wordMap, semanticMap, phoneticMap, subjectMap] =
      await Promise.all([
        loadQuranData(),
        loadMorphology(),
        loadWordMap(),
        loadSemanticData(),
        loadPhoneticData(),
        loadSubjectData(),
      ]);

    console.log(`✅ Loaded ${quranData.size} verses`);
    console.log(`✅ Loaded morphology data for ${morphologyMap.size} verses`);
    console.log(`✅ Loaded word map with ${wordMap.size} entries`);
    console.log(`✅ Loaded semantic data with ${semanticMap.size} entries`);
    console.log(`✅ Loaded phonetic data with ${phoneticMap.size} entries`);
    console.log(`✅ Loaded subject data with ${subjectMap.size} entries\n`);

    const buildStart = performance.now();
    const invertedIndex = buildInvertedIndex(
      morphologyMap,
      quranData,
      semanticMap,
      subjectMap,
      wordMap,
    );
    const buildMs = (performance.now() - buildStart).toFixed(2);

    console.log(`✅ Built inverted index in ${buildMs}ms`);
    console.log(`   - Lemma entries:    ${invertedIndex.lemmaIndex.size.toLocaleString()}`);
    console.log(`   - Root entries:     ${invertedIndex.rootIndex.size.toLocaleString()}`);
    console.log(`   - Word entries:     ${invertedIndex.wordIndex.size.toLocaleString()}`);
    console.log(
      `   - Semantic entries: ${invertedIndex.semanticIndex?.size.toLocaleString() ?? 0}`,
    );
    console.log(
      `   - Subject entries:  ${invertedIndex.subjectIndex?.size.toLocaleString() ?? 0}\n`,
    );

    const cache = new LRUCache(50);
    console.log('🗄️  Created LRU cache with capacity: 50\n');

    const context = {
      quranData,
      morphologyMap,
      wordMap,
      semanticMap,
      phoneticMap,
      subjectMap,
      invertedIndex,
    };

    // 1. Standard exact/lemma/root/fuzzy search.
    const examples = [
      { query: 'الله', description: 'Exact search for "Allah"' },
      { query: 'رحم', description: 'Root search for "mercy"' },
      { query: 'كتب', description: 'Search for "kataba" (wrote)' },
      {
        query: 'إنسان',
        description: 'Semantic search for "human" (finds "بشر")',
        semantic: true,
      },
      { query: 'Bismillah', description: 'Phonetic search for "Bismillah"' },
      {
        query: '+الله -الرحمن',
        description: 'Boolean MUST/EXCLUDE: "Allah" but not "Al-Rahman"',
      },
      {
        query: 'الرحيم | العليم',
        description: 'Boolean OR: "Al-Rahim" or "Al-Alim"',
      },
    ];

    for (const example of examples) {
      const response = search(
        example.query,
        context,
        {
          lemma: true,
          root: true,
          fuzzy: true,
          isRegex: false,
          semantic: example.semantic || false,
          suraId: example.suraId,
          juzId: example.juzId,
        },
        { page: 1, limit: 5 },
        undefined,
        cache,
      );
      printResults(`"${example.query}" — ${example.description}`, response);
    }

    // 2. Subject (thematic) search — v0.4.0.
    const subjectResponse = search(
      'climate',
      context,
      { lemma: true, root: true, subject: true },
      { page: 1, limit: 5 },
      undefined,
      cache,
    );
    printResults('"climate" — subject (thematic) search', subjectResponse);

    // 3. Multi-term search with ranking — v0.4.0.
    const multiTermResponse = search(
      ['محمد', 'يونس', 'إبراهيم'],
      context,
      { lemma: true, root: true },
      { page: 1, limit: 5, rankBy: 'coverage' },
      undefined,
      cache,
    );
    printResults('["محمد", "يونس", "إبراهيم"] — multi-term, rankBy coverage', multiTermResponse);

    // 4. Range search.
    const rangeResponse = search(
      '2:255',
      context,
      { lemma: true, root: true },
      { page: 1, limit: 1 },
      undefined,
      cache,
    );
    printResults('"2:255" — single-verse range lookup', rangeResponse);

    // 5. Boolean helper functions.
    console.log('🔧 Boolean helpers');
    console.log(SEPARATOR);
    console.log(
      `   hasBooleanOperators('+الله -الرحمن') => ${hasBooleanOperators('+الله -الرحمن')}`,
    );
    console.log(`   hasBooleanOperators('الله الرحمن')  => ${hasBooleanOperators('الله الرحمن')}`);
    console.log(
      `   clearBooleanOperators('+الله | الرحمن -الجحيم') => "${clearBooleanOperators('+الله | الرحمن -الجحيم')}"`,
    );
    console.log(SEPARATOR);
    console.log();

    // 6. Highlight ranges and export helpers.
    const highlightResponse = search(
      'الرحمن الرحيم',
      context,
      { lemma: true, root: true },
      { page: 1, limit: 1 },
      undefined,
      cache,
    );
    const verse = highlightResponse.results[0];
    if (verse) {
      const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
      console.log('🔧 Highlight + export helpers');
      console.log(SEPARATOR);
      console.log(`   Verse: ${verse.sura_id}:${verse.aya_id}`);
      console.log(`   Highlight ranges: ${JSON.stringify(ranges)}`);
      console.log(`   JSON export: ${exportResults(highlightResponse, 'json').length} bytes`);
      console.log(`   CSV export:  ${exportResults(highlightResponse, 'csv').length} bytes`);
      console.log(SEPARATOR);
      console.log();
    }

    // 7. Regex validation and search.
    console.log('═'.repeat(50));
    console.log('🔍 REGEX SEARCH DEMO');
    console.log('═'.repeat(50));

    const pattern = '^ال';
    const compiled = validateRegex(pattern);
    console.log(`\n   Pattern "${pattern}" validated as ${compiled}`);

    const regexResults = search(
      pattern,
      context,
      { lemma: false, root: false, fuzzy: false, isRegex: true, semantic: false },
      { page: 1, limit: 5 },
      undefined,
      cache,
    );
    console.log(`   Found ${regexResults.pagination.totalResults} matches`);
    console.log(`   Regex matches: ${regexResults.counts.regex}`);
    regexResults.results.forEach((v, index) => {
      console.log(`   ${index + 1}. ${v.sura_name} (${v.sura_id}:${v.aya_id})`);
      console.log(`      ${v.uthmani}`);
    });
    console.log('\n' + '═'.repeat(50));
    console.log();

    // 8. LRU cache demo.
    console.log('═'.repeat(50));
    console.log('🗄️  LRU CACHE DEMO');
    console.log('═'.repeat(50));

    const t1 = performance.now();
    const first = search(
      'الله',
      context,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    const d1 = (performance.now() - t1).toFixed(2);

    const t2 = performance.now();
    const second = search(
      'الله',
      context,
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    const d2 = (performance.now() - t2).toFixed(2);

    console.log(`\n   First  search: ${d1}ms (computed)`);
    console.log(`   Second search: ${d2}ms (cached)`);
    console.log(`   Same reference? ${first === second}`);
    console.log(`   Cache entries:  ${cache.size}`);

    const page2 = search(
      'الله',
      context,
      { lemma: true, root: true },
      { page: 2, limit: 20 },
      undefined,
      cache,
    );
    console.log(`\n   Page 2 is different object? ${first !== page2}`);
    console.log(`   Cache entries after page 2: ${cache.size}`);

    search('الله', context, { lemma: true, root: false }, { page: 1, limit: 20 }, undefined, cache);
    console.log(`   Cache entries after diff options: ${cache.size}`);

    console.log('\n' + '═'.repeat(50));
    console.log();

    // 9. Pre-computed Fuse index demo.
    console.log('═'.repeat(50));
    console.log('⚡ PRE-COMPUTED FUSE INDEX DEMO');
    console.log('═'.repeat(50));
    const fuseStart = performance.now();
    const fuseIndex = createArabicFuseSearch(Array.from(quranData.values()), [
      'standard',
      'uthmani',
    ]);
    const fuseMs = (performance.now() - fuseStart).toFixed(2);
    const fuseResponse = search(
      'الرحمن',
      context,
      { lemma: true, root: true, fuzzy: true },
      { page: 1, limit: 3 },
      fuseIndex,
      cache,
    );
    console.log(`\n   Built Fuse index in ${fuseMs}ms`);
    console.log(`   Search with pre-built index: ${fuseResponse.pagination.totalResults} matches`);
    console.log('\n' + '═'.repeat(50));
    console.log();

    // 10. Dataset metadata.
    console.log('📚 Dataset metadata');
    console.log(SEPARATOR);
    console.log(`   Suras: ${SURAS.length}`);
    console.log(`   First sura: ${SURAS[0].sura_name} (${SURAS[0].sura_name_en})`);
    console.log(`   Normalized sample: "${normalizeArabic('ٱلرَّحْمَٰن')}"`);
    console.log(SEPARATOR);
    console.log();

    // 11. Custom search from the command line.
    const queryArg = process.argv[2];
    if (queryArg) {
      const customResults = search(
        queryArg,
        context,
        { lemma: true, root: true, fuzzy: true, isRegex: false, semantic: true },
        { page: 1, limit: 10 },
        undefined,
        cache,
      );
      printResults(`Custom search: "${queryArg}"`, customResults, 10);
    } else {
      console.log('💡 Tip: Run with a search term as argument:');
      console.log('   yarn playground:node "your search term"');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
