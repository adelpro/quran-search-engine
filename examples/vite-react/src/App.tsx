import { useState, useEffect, useMemo, useRef } from 'react';
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
  type MultiTermResponse,
  type RankBy,
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
    semanticCount: number;
  } | null>(null);
  const [indexBuildTime, setIndexBuildTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [usingWorker, setUsingWorker] = useState<boolean | null>(null);

  const workerClient = useRef<SearchWorkerClient | null>(null);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  // Multi-term mode is auto-detected from the input: any 2+ whitespace-
  // separated words dispatch to search()'s array overload (independent
  // per-term search merged by gid); a single word goes through the normal
  // single-query path. Memoized so `terms` keeps a stable reference across
  // renders that don't change debouncedQuery — it's shared with the search
  // effect below and included in that effect's own dependency array.
  const terms = useMemo(() => debouncedQuery.split(/\s+/).filter(Boolean), [debouncedQuery]);
  const isMultiTerm = terms.length > 1;
  const singleQuery = terms[0] ?? debouncedQuery;

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [rankBy, setRankBy] = useState<RankBy>('score');
  const [multiTermResponse, setMultiTermResponse] = useState<MultiTermResponse | null>(null);

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
            const index = buildInvertedIndex(morphology, data, semantic);
            const buildMs = performance.now() - buildStart;

            if (!cancelled) {
              setInvertedIndex(index);
              setIndexStats({
                lemmaCount: index.lemmaIndex.size,
                rootCount: index.rootIndex.size,
                wordCount: index.wordIndex.size,
                semanticCount: index.semanticIndex?.size ?? 0,
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
            const index = buildInvertedIndex(morphology, data, semantic);
            const buildMs = performance.now() - buildStart;

            setIndexStats({
              lemmaCount: index.lemmaIndex.size,
              rootCount: index.rootIndex.size,
              wordCount: index.wordIndex.size,
              semanticCount: index.semanticIndex?.size ?? 0,
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
      setMultiTermResponse(null);
      return;
    }

    let cancelled = false;

    if (workerClient.current) {
      setSearching(true);
      setUsingWorker(true);
      const request = isMultiTerm
        ? workerClient.current
            .runSearchMany(terms, options, { page: currentPage, limit: PAGE_SIZE, rankBy })
            .then((res) => {
              if (!cancelled) {
                setMultiTermResponse(res);
                setSearchResponse(null);
              }
            })
        : workerClient.current
            .runSearch(singleQuery, options, { page: currentPage, limit: PAGE_SIZE })
            .then((res) => {
              if (!cancelled) {
                setSearchResponse(res);
                setMultiTermResponse(null);
              }
            });
      request
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
      const context = {
        quranData,
        morphologyMap,
        wordMap,
        semanticMap,
        phoneticMap,
        invertedIndex,
      };

      if (isMultiTerm) {
        // Array overload — terms: string[] dispatches to the multi-term path.
        const response = search(
          terms,
          context,
          options,
          { page: currentPage, limit: PAGE_SIZE, rankBy },
          undefined,
          searchCache,
        );
        setMultiTermResponse(response);
        setSearchResponse(null);
      } else {
        // String overload — the original single-query path, unchanged.
        const response = search(
          singleQuery,
          context,
          options,
          { page: currentPage, limit: PAGE_SIZE },
          undefined,
          searchCache,
        );
        setSearchResponse(response);
        setMultiTermResponse(null);
      }
      setSearching(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    debouncedQuery,
    terms,
    isMultiTerm,
    singleQuery,
    options,
    currentPage,
    rankBy,
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
  }, [debouncedQuery, options, rankBy]);

  const activeResponse = isMultiTerm ? multiTermResponse : searchResponse;

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
              <span>
                <strong>{indexStats.lemmaCount.toLocaleString()}</strong> lemmas ·{' '}
                <strong>{indexStats.rootCount.toLocaleString()}</strong> roots ·{' '}
                <strong>{indexStats.wordCount.toLocaleString()}</strong> words
              </span>
              <span>
                <strong>{indexStats.semanticCount.toLocaleString()}</strong> semantic
              </span>
              {indexBuildTime !== null && <span>Index: {indexBuildTime.toFixed(1)}ms</span>}
            </span>
          )}
        </div>
      </header>

      <div className="search-input-group">
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Search for a word (e.g. كتب) — or several words for independent multi-term search (e.g. الله الرحمن)..."
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
        {isMultiTerm && (
          <label
            className="option-item"
            title="Multi-word input searches each term independently via search(terms: string[]) and merges results by verse gid"
          >
            Rank by:
            <select
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value as RankBy)}
              style={{ marginLeft: '5px' }}
            >
              <option value="score">Score</option>
              <option value="coverage">Coverage (distinct terms)</option>
              <option value="frequency">Frequency (raw hits)</option>
            </select>
          </label>
        )}
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

      {activeResponse && (
        <>
          <div className="results-info">
            <div className="results-count">
              Found <strong>{activeResponse.pagination.totalResults}</strong> matches
              {activeResponse.pagination.totalResults > 0 &&
                ` (showing page ${activeResponse.pagination.currentPage} of ${activeResponse.pagination.totalPages})`}
            </div>
            <div className="results-stats">
              <span className="stat-item">
                <span className="indicator indicator-exact"></span>
                <span className="stat-label">Exact:</span>
                <span className="stat-value">{activeResponse.counts.simple}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-lemma"></span>
                <span className="stat-label">Lemma:</span>
                <span className="stat-value">{activeResponse.counts.lemma}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-root"></span>
                <span className="stat-label">Root:</span>
                <span className="stat-value">{activeResponse.counts.root}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-fuzzy"></span>
                <span className="stat-label">Fuzzy:</span>
                <span className="stat-value">{activeResponse.counts.fuzzy}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Semantic:</span>
                <span className="stat-value">{activeResponse.counts.semantic}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Range:</span>
                <span className="stat-value">{activeResponse.counts.range}</span>
              </span>
              <span className="stat-item">
                <span className="indicator indicator-semantic"></span>
                <span className="stat-label">Regex:</span>
                <span className="stat-value">{activeResponse.counts.regex}</span>
              </span>
            </div>
          </div>

          <div className="results-list">
            {activeResponse.results.map((verse) => (
              <VerseItem
                key={verse.gid}
                verse={verse}
                query={query}
                morphologyMap={morphologyMap!}
                wordMap={wordMap!}
              />
            ))}
          </div>

          {activeResponse.pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <span>
                Page {currentPage} of {activeResponse.pagination.totalPages}
              </span>
              <button
                className="page-btn"
                disabled={currentPage === activeResponse.pagination.totalPages}
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
