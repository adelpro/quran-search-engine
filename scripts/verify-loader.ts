import { loadQuranData, loadMorphology, loadWordMap, search } from '../src/index';
import { simpleSearch } from '../src/core/search';
import { getPositiveTokens } from '../src/core/tokenization';

const verify = async () => {
  console.log('🚀 Starting Comprehensive Verification...');

  try {
    // 1. Test loadQuranData
    console.time('loadQuranData');
    const quranData = await loadQuranData();
    console.timeEnd('loadQuranData');
    console.log(`✅ Quran Data loaded: ${quranData.length} verses`);

    // 2. Test loadMorphology
    console.time('loadMorphology');
    const morphologyMap = await loadMorphology();
    console.timeEnd('loadMorphology');
    console.log(`✅ Morphology Map loaded: ${morphologyMap.size} entries`);

    // 3. Test loadWordMap
    console.time('loadWordMap');
    const wordMap = await loadWordMap();
    console.timeEnd('loadWordMap');
    console.log(`✅ Word Map loaded: ${Object.keys(wordMap).length} keys`);

    // 4. Test simpleSearch
    console.log('\n🔍 Testing simpleSearch (Searching for "الله")...');
    const simpleResults = simpleSearch(quranData, 'الله', 'standard');
    console.log(`✅ simpleSearch found ${simpleResults.length} matches.`);

    // 5. Test search (Morphological + Scoring + Pagination)
    console.log('\n🔬 Testing search with Pagination (page: 1, limit: 5)...');
    const searchResponse = search(
      'كتب',
      quranData,
      morphologyMap,
      wordMap,
      { lemma: true, root: true },
      { page: 1, limit: 5 },
    );

    console.log(`✅ Page 1 returned ${searchResponse.results.length} results.`);
    console.log('📊 Pagination Metadata:', searchResponse.pagination);
    console.log('📊 Global Counts:', searchResponse.counts);

    if (searchResponse.pagination.totalPages > 1) {
      console.log('\n⏭️  Testing Page 2 (limit: 5)...');
      const page2Response = search(
        'كتب',
        quranData,
        morphologyMap,
        wordMap,
        { lemma: true, root: true },
        { page: 2, limit: 5 },
      );
      console.log(`✅ Page 2 returned ${page2Response.results.length} results.`);
      const isDifferent = page2Response.results[0]?.gid !== searchResponse.results[0]?.gid;
      console.log(`✅ Result differentiation check: ${isDifferent ? 'PASSED' : 'FAILED'}`);
    }

    if (searchResponse.results.length > 0) {
      const bestMatch = searchResponse.results[0];
      const query = 'كتب';
      const queryEntry = wordMap[query];
      const highlightMode =
        bestMatch.matchType === 'root'
          ? 'root'
          : bestMatch.matchType === 'lemma'
            ? 'lemma'
            : 'text';
      console.log('\n🏆 Best Match from Page 1:', {
        gid: bestMatch.gid,
        uthmani: bestMatch.uthmani,
        matchType: bestMatch.matchType,
        score: bestMatch.matchScore,
      });

      // 6. Test getPositiveTokens (Highlighting)
      const tokens = getPositiveTokens(
        bestMatch,
        highlightMode,
        highlightMode === 'lemma' ? queryEntry?.lemma : undefined,
        highlightMode === 'root' ? queryEntry?.root : undefined,
        query,
        morphologyMap,
        wordMap,
      );
      console.log('🏷️  Matched Tokens for highlighting:', tokens);
    }

    console.log('\n✨ All Verifications Passed successfully!');
  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
  }
};

verify();
