import { useState, useEffect, useRef } from 'react';
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadPhoneticData,
  buildInvertedIndex,
  search,
  LRUCache,
  createSearchWorker,
  supportsWorkers,
  type QuranText,
  type MorphologyAya,
  type WordMap,
  type InvertedIndex,
  type SearchResponse,
  type SearchWorkerClient,
} from 'quran-search-engine';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from './useDebounce';
import { VerseItem } from './components/VerseItem';
import './App.css';

const searchCache = new LRUCache<string, SearchResponse<QuranText>>(50);

let workerUrl: string | null = null;
let workerInitPromise: Promise<SearchWorkerClient> | null = null;

async function loadWorkerUrl() {
  if (!workerUrl) {
    const mod = await import('quran-search-engine/worker?url');
    workerUrl = mod.default;
  }
  return workerUrl;
}

function App() {
  const [quranData, setQuranData] = useState<Map<number, QuranText> | null>(null);
  const [morphologyMap, setMorphologyMap] = useState<Map<number, MorphologyAya> | null>(null);
  const [wordMap, setWordMap] = useState<WordMap | null>(null);
  const [semanticMap, setSemanticMap] = useState<Map<string, string[]> | null>(null);
  const [phoneticMap, setPhoneticMap] = useState<Map<string, string[]> | null>(null);
  const [invertedIndex, setInvertedIndex] = useState<InvertedIndex | null>(null);
  const [indexStats, setIndexStats] = useState<{
    lemmaCount: number;
    rootCount: number;
    wordCount: number;
  } | null>(null);
  const [indexBuildTime, setIndexBuildTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [usingWorker, setUsingWorker] = useState<boolean | null>(null);

  const workerClient = useRef<SearchWorkerClient | null>(null);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

  const [options, setOptions] = useState({
    lemma: true,
    root: true,
    fuzzy: true,
    isRegex: false,
    semantic: true,
    suraId: undefined as number | undefined,
    juzId: undefined as number | undefined,
    suraName: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (supportsWorkers()) {
          try {
            if (!workerInitPromise) {
              workerInitPromise = (async () => {
                const url = await loadWorkerUrl();
                const client = createSearchWorker({ workerUrl: url });
                await client.initData();
                return client;
              })();
            }
            const client = await workerInitPromise;
            if (!cancelled) {
              workerClient.current = client;
            }
          } catch (err) {
            console.warn('Web Worker init failed, falling back to main thread:', err);
          }
        }

        if (!workerClient.current) {
          const [data, morphology, dictionary, semantic, phonetic] = await Promise.all([
            loadQuranData(),
            loadMorphology(),
            loadWordMap(),
            loadSemanticData(),
            loadPhoneticData(),
          ]);
          if (!cancelled) {
            setQuranData(data);
            setMorphologyMap(morphology);
            setWordMap(dictionary);
            setSemanticMap(semantic);
            setPhoneticMap(phonetic);

            const buildStart = performance.now();
            const index = buildInvertedIndex(morphology, data, semantic, phonetic);
            const buildMs = performance.now() - buildStart;

            if (!cancelled) {
              setInvertedIndex(index);
              setIndexStats({
                lemmaCount: index.lemmaIndex.size,
                rootCount: index.rootIndex.size,
                wordCount: index.wordIndex.size,
              });
              setIndexBuildTime(buildMs);
            }
          }
        } else {
          // When using worker, still build index for stats display
          const [data, morphology, , semantic, phonetic] = await Promise.all([
            loadQuranData(),
            loadMorphology(),
            loadWordMap(),
            loadSemanticData(),
            loadPhoneticData(),
          ]);

          if (!cancelled) {
            const buildStart = performance.now();
            const index = buildInvertedIndex(morphology, data, semantic, phonetic);
            const buildMs = performance.now() - buildStart;

            setIndexStats({
              lemmaCount: index.lemmaIndex.size,
              rootCount: index.rootIndex.size,
              wordCount: index.wordIndex.size,
            });
            setIndexBuildTime(buildMs);
          }
        }
      } catch (error) {
        console.error('Failed to load Quran data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();

    return () => {
      cancelled = true;
      workerClient.current?.terminate();
    };
  }, []);

  // 2. Search Logic — Worker path (async) or fallback (sync)
  useEffect(() => {
    if (loading || !debouncedQuery.trim()) {
      setSearchResponse(null);
      return;
    }

    let cancelled = false;

    if (workerClient.current) {
      setSearching(true);
      setUsingWorker(true);
      workerClient.current
        .runSearch(debouncedQuery, options, { page: currentPage, limit: PAGE_SIZE })
        .then((res) => {
          if (!cancelled) setSearchResponse(res);
        })
        .catch((err) => console.error('Worker search error:', err))
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    } else if (
      quranData &&
      quranData.size > 0 &&
      morphologyMap &&
      wordMap &&
      semanticMap &&
      phoneticMap &&
      invertedIndex
    ) {
      setSearching(true);
      setUsingWorker(false);
      const response = search(
        debouncedQuery,
        {
          quranData,
          morphologyMap,
          wordMap,
          semanticMap,
          phoneticMap,
          invertedIndex,
        },
        options,
        { page: currentPage, limit: PAGE_SIZE },
        undefined,
        searchCache,
      );
      setSearchResponse(response);
      setSearching(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    debouncedQuery,
    options,
    currentPage,
    quranData,
    morphologyMap,
    wordMap,
    semanticMap,
    phoneticMap,
    invertedIndex,
    loading,
  ]);

  // Reset page when query or options change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, options]);

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" size={32} />
        <span style={{ marginLeft: '1rem' }}>Loading Quranic datasets...</span>
      </div>
    );
  }

  return (
    <div className="search-container">
      <header className="search-header">
        <h1>
          Quran Search Engine <small style={{ fontSize: '0.8rem', opacity: 0.6 }}>Demo</small>
        </h1>
        <div className="badges-container">
          {usingWorker !== null && (
            <span
              className={`worker-badge ${usingWorker ? 'worker-badge--active' : 'worker-badge--fallback'}`}
            >
              {usingWorker ? 'Running on Web Worker' : 'Running on Main Thread'}
            </span>
          )}
          {indexStats && (
            <span
              className="index-stats"
              title={`Inverted index built in ${indexBuildTime?.toFixed(1)}ms`}
            >
              <strong>{indexStats.lemmaCount.toLocaleString()}</strong> lemmas ·{' '}
              <strong>{indexStats.rootCount.toLocaleString()}</strong> roots ·{' '}
              <strong>{indexStats.wordCount.toLocaleString()}</strong> words
              {indexBuildTime !== null && <span> ({indexBuildTime.toFixed(1)}ms)</span>}
            </span>
          )}
        </div>
      </header>

      <div className="search-input-group">
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Search for a word (e.g., كتب, الله, رحم)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {searching ? (
          <Loader2 className="search-icon animate-spin" size={24} />
        ) : (
          <Search className="search-icon" size={24} />
        )}
      </div>

      <div className="options-group">
        <label className="option-item">
          <input
            type="checkbox"
            checked={options.lemma}
            onChange={(e) => setOptions({ ...options, lemma: e.target.checked })}
          />
          Lemma Search
        </label>
        <label className="option-item">
          <input
            type="checkbox"
            checked={options.root}
            onChange={(e) => setOptions({ ...options, root: e.target.checked })}
          />
          Root Search
        </label>
        <label className="option-item">
          <input
            type="checkbox"
            checked={options.fuzzy}
            onChange={(e) => setOptions({ ...options, fuzzy: e.target.checked })}
          />
          Fuzzy Search
        </label>
        <label className="option-item">
          <input
            type="checkbox"
            checked={options.semantic}
            onChange={(e) => setOptions({ ...options, semantic: e.target.checked })}
          />
          Semantic Search
        </label>
        <label className="option-item">
          <input
            type="checkbox"
            checked={options.isRegex}
            onChange={(e) => setOptions({ ...options, isRegex: e.target.checked })}
          />
          Regex Search
        </label>
        <label className="option-item">
          Sura ID:
          <input
            type="number"
            min="1"
            max="114"
            value={options.suraId ?? ''}
            onChange={(e) =>
              setOptions({
                ...options,
                suraId: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            style={{ width: '60px', marginLeft: '5px' }}
          />
        </label>
        <label className="option-item">
          Juz ID:
          <input
            type="number"
            min="1"
            max="30"
            value={options.juzId ?? ''}
            onChange={(e) =>
              setOptions({
                ...options,
                juzId: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            style={{ width: '60px', marginLeft: '5px' }}
          />
        </label>
        <label className="option-item">
          Sura Name:
          <input
            type="text"
            placeholder="Ex: الفاتحة or Fatiha"
            value={options.suraName}
            onChange={(e) => setOptions({ ...options, suraName: e.target.value })}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9rem',
              width: '140px',
            }}
          />
        </label>
      </div>

      {searchResponse && (
        <>
          <div className="results-info">
            <div className="results-count">
              Found <strong>{searchResponse.pagination.totalResults}</strong> matches
              {searchResponse.pagination.totalResults > 0 &&
                ` (showing page ${searchResponse.pagination.currentPage} of ${searchResponse.pagination.totalPages})`}
            </div>
            <div className="results-stats">
              <span className="stat-item">
                <span className="indicator indicator-exact"></span>
                <span className="stat-label">Exact:</span>
                <span className="stat-value">{searchResponse.counts.simple}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-lemma"></span>
                <span className="stat-label">Lemma:</span>
                <span className="stat-value">{searchResponse.counts.lemma}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-root"></span>
                <span className="stat-label">Root:</span>
                <span className="stat-value">{searchResponse.counts.root}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-fuzzy"></span>
                <span className="stat-label">Fuzzy:</span>
                <span className="stat-value">{searchResponse.counts.fuzzy}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Semantic:</span>
                <span className="stat-value">{searchResponse.counts.semantic}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Range:</span>
                <span className="stat-value">{searchResponse.counts.range}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Regex:</span>
                <span className="stat-value">{searchResponse.counts.regex}</span>
              </span>
            </div>
          </div>

          <div className="results-list">
            {searchResponse.results.map((verse) => (
              <VerseItem
                key={verse.gid}
                verse={verse}
                query={query}
                morphologyMap={morphologyMap!}
                wordMap={wordMap!}
              />
            ))}
          </div>

          {searchResponse.pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <span>
                Page {currentPage} of {searchResponse.pagination.totalPages}
              </span>
              <button
                className="page-btn"
                disabled={currentPage === searchResponse.pagination.totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
