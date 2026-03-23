import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadPhoneticData,
  buildInvertedIndex,
  search,
  LRUCache,
} from 'quran-search-engine';

async function main() {
  console.log('🚀 Loading Quran Search Engine data...\n');

  try {
    const [quranData, morphologyMap, wordMap, semanticMap, phoneticMap] = await Promise.all([
      loadQuranData(),
      loadMorphology(),
      loadWordMap(),
      loadSemanticData(),
      loadPhoneticData(),
    ]);

    console.log(`✅ Loaded ${quranData.size} verses`);
    console.log(`✅ Loaded morphology data for ${morphologyMap.size} verses`);
    console.log(`✅ Loaded word map with ${Object.keys(wordMap).length} entries`);
    console.log(`✅ Loaded semantic data with ${semanticMap.size} entries`);
    console.log(`✅ Loaded phonetic data with ${phoneticMap.size} entries\n`);

    const buildStart = performance.now();
    const invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap);
    const buildMs = (performance.now() - buildStart).toFixed(2);

    console.log(`✅ Built inverted index in ${buildMs}ms`);
    console.log(`   - Lemma entries: ${invertedIndex.lemmaIndex.size.toLocaleString()}`);
    console.log(`   - Root entries:  ${invertedIndex.rootIndex.size.toLocaleString()}`);
    console.log(`   - Word entries:  ${invertedIndex.wordIndex.size.toLocaleString()}`);
    console.log(
      `   - Semantic entries: ${invertedIndex.semanticIndex?.size.toLocaleString() ?? 0}\n`,
    );

    const cache = new LRUCache(50);
    console.log(`🗄️  Created LRU cache with capacity: 50\n`);

    const examples = [
      { query: 'الله', description: 'Search for "Allah"' },
      { query: 'رحم', description: 'Search for root "رحم" (mercy)' },
      { query: 'كتب', description: 'Search for "kataba" (wrote)' },
      { query: 'إنسان', description: 'Semantic search for human (finding "بشر")', semantic: true },
      { query: 'الله', description: 'Search for "Allah" in Al-Fatiha (Sura 1)', suraId: 1 },
      { query: 'الناس', description: 'Search for "An-Nas" (Sura 114)', suraId: 114 },
    ];

    for (const example of examples) {
      console.log(`🔍 ${example.description}: "${example.query}"`);
      console.log('─'.repeat(50));

      const results = search(
        example.query,
        {
          quranData,
          morphologyMap,
          wordMap,
          semanticMap,
          phoneticMap,
          invertedIndex,
        },
        {
          lemma: true,
          root: true,
          fuzzy: true,
          isRegex: false,
          semantic: example.semantic || false,
          suraId: example.suraId,
          juzId: example.juzId,
        },
        {
          page: 1,
          limit: 5,
        },
        undefined,
        cache,
      );

      console.log(`📊 Found ${results.pagination.totalResults} matches`);
      console.log(`   - Exact: ${results.counts.simple}`);
      console.log(`   - Lemma: ${results.counts.lemma}`);
      console.log(`   - Root: ${results.counts.root}`);
      console.log(`   - Fuzzy: ${results.counts.fuzzy}`);
      console.log(`   - Semantic: ${results.counts.semantic}`);
      console.log(`   - Range: ${results.counts.range}`);
      console.log(`   - Regex: ${results.counts.regex}`);

      results.results.forEach((verse, index) => {
        console.log(`   ${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
        console.log(`      Match: ${verse.matchType} (Score: ${verse.matchScore})`);
        console.log(`      Text: ${verse.uthmani}`);
      });

      console.log('─'.repeat(50));
      console.log();
    }

    console.log('═'.repeat(50));
    console.log('🗄️  LRU CACHE DEMO');
    console.log('═'.repeat(50));

    const t1 = performance.now();
    const first = search(
      'الله',
      {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      },
      { lemma: true, root: true },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    const d1 = (performance.now() - t1).toFixed(2);

    const t2 = performance.now();
    const second = search(
      'الله',
      {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      },
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
      {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      },
      { lemma: true, root: true },
      { page: 2, limit: 20 },
      undefined,
      cache,
    );
    console.log(`\n   Page 2 is different object? ${first !== page2}`);
    console.log(`   Cache entries after page 2: ${cache.size}`);

    const noRoot = search(
      'الله',
      {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      },
      { lemma: true, root: false },
      { page: 1, limit: 20 },
      undefined,
      cache,
    );
    console.log(`   Cache entries after diff options: ${cache.size}`);

    console.log('\n\u2550'.repeat(50));
    console.log();

    console.log('═'.repeat(50));
    console.log('🔍 REGEX SEARCH DEMO');
    console.log('═'.repeat(50));

    const regexResults = search(
      '^ال',
      {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      },
      { lemma: false, root: false, fuzzy: false, isRegex: true, semantic: false },
      { page: 1, limit: 5 },
      undefined,
      cache,
    );

    console.log(`\n   Search: "^ال" (starts with "ال")`);
    console.log(`   Found ${regexResults.pagination.totalResults} matches`);
    console.log(`   Regex matches: ${regexResults.counts.regex}`);

    regexResults.results.forEach((verse, index) => {
      console.log(`   ${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
      console.log(`      ${verse.uthmani}`);
    });

    console.log('\n\u2550'.repeat(50));
    console.log();

    const queryArg = process.argv[2];
    if (queryArg) {
      console.log(`🔍 Custom search: "${queryArg}"`);
      console.log('─'.repeat(50));

      const customResults = search(
        queryArg,
        {
          quranData,
          morphologyMap,
          wordMap,
          semanticMap,
          phoneticMap,
          invertedIndex,
        },
        { lemma: true, root: true, fuzzy: true, isRegex: false, semantic: true },
        { page: 1, limit: 10 },
        undefined,
        cache,
      );

      console.log(`📊 Found ${customResults.pagination.totalResults} matches\n`);
      console.log(`   - Exact: ${customResults.counts.simple}`);
      console.log(`   - Lemma: ${customResults.counts.lemma}`);
      console.log(`   - Root: ${customResults.counts.root}`);
      console.log(`   - Fuzzy: ${customResults.counts.fuzzy}`);
      console.log(`   - Semantic: ${customResults.counts.semantic}`);
      console.log(`   - Range: ${customResults.counts.range}`);
      console.log(`   - Regex: ${customResults.counts.regex}\n`);

      customResults.results.forEach((verse, index) => {
        console.log(`${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
        console.log(`   ${verse.uthmani}`);
        console.log();
      });
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
