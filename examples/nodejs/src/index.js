import { loadQuranData, loadMorphology, loadWordMap, search, LRUCache } from 'quran-search-engine';

async function main() {
    console.log('🚀 Loading Quran Search Engine data...\n');

    try {
        // Load all required data
        const [quranData, morphologyMap, wordMap] = await Promise.all([
            loadQuranData(),
            loadMorphology(),
            loadWordMap(),
        ]);

        console.log(`✅ Loaded ${quranData.length} verses`);
        console.log(`✅ Loaded morphology data for ${morphologyMap.size} verses`);
        console.log(`✅ Loaded word map with ${Object.keys(wordMap).length} entries\n`);

        // Create a shared LRU cache for all searches (capacity: 50 results)
        const cache = new LRUCache(50);
        console.log(`🗄️  Created LRU cache with capacity: 50\n`);

        // Example searches
        const examples = [
            { query: 'الله', description: 'Search for "Allah"' },
            { query: 'رحم', description: 'Search for root "رحم" (mercy)' },
            { query: 'كتب', description: 'Search for "kataba" (wrote)' },
            { query: 'الله', description: 'Search for "Allah" in Al-Fatiha (Sura 1)', suraId: 1 },
            { query: 'الناس', description: 'Search for "An-Nas" (Sura 114)', suraId: 114 },
        ];

        for (const example of examples) {
            console.log(`🔍 ${example.description}: "${example.query}"`);
            console.log('─'.repeat(50));

            const results = search(
                example.query,
                quranData,
                morphologyMap,
                wordMap,
                {
                    lemma: true,
                    root: true,
                    fuzzy: true,
                    suraId: example.suraId,
                    juzId: example.juzId,
                },
                {
                    page: 1,
                    limit: 5,
                },
                cache, // Pass cache to every search call
            );

            console.log(`📊 Found ${results.pagination.totalResults} matches`);
            console.log(`   - Exact: ${results.counts.simple}`);
            console.log(`   - Lemma: ${results.counts.lemma}`);
            console.log(`   - Root: ${results.counts.root}`);
            console.log(`   - Fuzzy: ${results.counts.fuzzy}`);

            // Display top results
            results.results.forEach((verse, index) => {
                console.log(`   ${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
                console.log(`      Match: ${verse.matchType} (Score: ${verse.matchScore})`);
                console.log(`      Text: ${verse.uthmani}`);
            });

            console.log('─'.repeat(50));
            console.log();
        }

        // ═══════════════════════════════════════════════════
        // LRU Cache Demo: shows cache hits vs fresh searches
        // ═══════════════════════════════════════════════════
        console.log('═'.repeat(50));
        console.log('🗄️  LRU CACHE DEMO');
        console.log('═'.repeat(50));

        // First search — cache MISS (computed fresh)
        const t1 = performance.now();
        const first = search('الله', quranData, morphologyMap, wordMap, { lemma: true, root: true }, { page: 1, limit: 20 }, cache);
        const d1 = (performance.now() - t1).toFixed(2);

        // Same query again — cache HIT (instant)
        const t2 = performance.now();
        const second = search('الله', quranData, morphologyMap, wordMap, { lemma: true, root: true }, { page: 1, limit: 20 }, cache);
        const d2 = (performance.now() - t2).toFixed(2);

        console.log(`\n   First  search: ${d1}ms (computed)`);
        console.log(`   Second search: ${d2}ms (cached)`);
        console.log(`   Same reference? ${first === second}`); // true = cache hit
        console.log(`   Cache entries:  ${cache.size}`);

        // Different page — separate cache entry
        const page2 = search('الله', quranData, morphologyMap, wordMap, { lemma: true, root: true }, { page: 2, limit: 20 }, cache);
        console.log(`\n   Page 2 is different object? ${first !== page2}`); // true
        console.log(`   Cache entries after page 2: ${cache.size}`);

        // Different options — separate cache entry
        const noRoot = search('الله', quranData, morphologyMap, wordMap, { lemma: true, root: false }, { page: 1, limit: 20 }, cache);
        console.log(`   Cache entries after diff options: ${cache.size}`);

        console.log('\n═'.repeat(50));
        console.log();

        // Interactive search if arguments provided
        const queryArg = process.argv[2];
        if (queryArg) {
            console.log(`🔍 Custom search: "${queryArg}"`);
            console.log('─'.repeat(50));

            const customResults = search(
                queryArg,
                quranData,
                morphologyMap,
                wordMap,
                { lemma: true, root: true, fuzzy: true },
                { page: 1, limit: 10 },
                cache,
            );

            console.log(`📊 Found ${customResults.pagination.totalResults} matches\n`);

            customResults.results.forEach((verse, index) => {
                console.log(`${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
                console.log(`   ${verse.uthmani}`);
                console.log();
            });
        } else {
            console.log('💡 Tip: Run with a search term as argument:');
            console.log('   pnpm start "your search term"');
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
