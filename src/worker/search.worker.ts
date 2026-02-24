
import { search } from '../core/search';
import { loadQuranData, loadMorphology, loadWordMap } from '../utils/loader';
import { AdvancedSearchOptions, PaginationOptions } from '../types';
let cache: any = null;


interface SearchMessage {
query: string;
  options: AdvancedSearchOptions;
  pagination: PaginationOptions;
}

self.onmessage = async (e: MessageEvent<SearchMessage>) => {
  const { query, options, pagination } = e.data;

  try {
    if (!cache) {
      // تحميل البيانات في المسار الخلفي
      const [quran, morphology, wordMap] = await Promise.all([
        loadQuranData(),
        loadMorphology(),
        loadWordMap()
      ]);
      cache = { quran, morphology, wordMap };
    }

    const results = search(
      query,
      cache.quran,
      cache.morphology,
      cache.wordMap,
      options,
      pagination
    );

    self.postMessage({ type: 'SUCCESS', results });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', message: error.message });
  }
};