import { loadQuranData, loadMorphology, loadWordMap, search } from 'quran-search-engine';

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

        // Example searches
        const examples = [
            { query: 'الله', description: 'Search for "Allah"' },
            { query: 'رحم', description: 'Search for root "رحم" (mercy)' },
            { query: 'كتب', description: 'Search for "kataba" (wrote)' },
            { query: 'الله', description: 'Search for "Allah" in Al-Fatiha (Sura 1)', suraId: 1 }, //+
            { query: 'الناس', description: 'Search for "An-Nas" (Sura 114)', suraId: 114 }, //+
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
                    suraId: example.suraId, //+  dynamic Injection
                    juzId: example.juzId,  //+  dynami Injection
                    
                },
                {
                    page: 1,
                    limit: 5, // Show only first 5 results
                },
            );

            console.log(`📊 Found ${results.pagination.totalResults} matches`);
            console.log(`   - Exact: ${results.counts.simple}`);
            console.log(`   - Lemma: ${results.counts.lemma}`);
            console.log(`   - Root: ${results.counts.root}`);
            console.log(`   - Fuzzy: ${results.counts.fuzzy}\n`);

            // Display top results
            results.results.forEach((verse, index) => {
                console.log(`${index + 1}. ${verse.sura_name} (${verse.sura_id}:${verse.aya_id})`);
                console.log(`   Match: ${verse.matchType} (Score: ${verse.matchScore})`);
                console.log(`   Text: ${verse.uthmani}`);
                console.log();
            });

            console.log('─'.repeat(50));
            console.log();
        }

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
                {
                    lemma: true,
                    root: true,
                    fuzzy: true,
                },
                {
                    page: 1,
                    limit: 10,
                },
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main();
