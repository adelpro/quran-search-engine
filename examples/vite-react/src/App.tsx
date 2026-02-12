import { useState, useEffect } from 'react';
import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  search,
  type QuranText,
  type MorphologyAya,
  type WordMap,
  type SearchResponse,
} from 'quran-search-engine';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from './useDebounce';
import { VerseItem } from './components/VerseItem';
import './App.css';

function App() {
  const [quranData, setQuranData] = useState<QuranText[]>([]);
  const [morphologyMap, setMorphologyMap] = useState<Map<number, MorphologyAya> | null>(null);
  const [wordMap, setWordMap] = useState<WordMap | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [options, setOptions] = useState({
    lemma: true,
    root: true,
    fuzzy: true,
    suraId: undefined as number | undefined,
    juzId: undefined as number | undefined,
    suraName: "" // Advanced filter by Surah name
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // 1. Initial Data Loading
  useEffect(() => {
    async function init() {
      try {
        const [data, morphology, dictionary] = await Promise.all([
          loadQuranData(),
          loadMorphology(),
          loadWordMap(),
        ]);
        setQuranData(data);
        setMorphologyMap(morphology);
        setWordMap(dictionary);
      } catch (error) {
        console.error('Failed to load Quran data:', error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 2. Search Logic
  useEffect(() => {
    if (!loading && quranData.length > 0 && morphologyMap && wordMap && debouncedQuery.trim()) {
      const response = search(debouncedQuery, quranData, morphologyMap, wordMap, options, {
        page: currentPage,
        limit: PAGE_SIZE,
      });

      setSearchResponse(response);
    } else {
      setSearchResponse(null);
    }
  }, [debouncedQuery, options, currentPage, quranData, morphologyMap, wordMap, loading]);

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
        <Search className="search-icon" size={24} />
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
          Sura ID:
          <input
            type="number"
            min="1" max="114"
            onChange={(e) => setOptions({ ...options, suraId: e.target.value ? parseInt(e.target.value) : undefined })}
            style={{ width: '60px', marginLeft: '5px' }}
          />
        </label>
        <label className="option-item">
          Juz ID:
          <input
            type="number"
            min="1" max="30"
            onChange={(e) => setOptions({ ...options, juzId: e.target.value ? parseInt(e.target.value) : undefined })}
            style={{ width: '60px', marginLeft: '5px' }}
          />
        </label>
        <label className="option-item">
          Sura Name:
        <input
            type="text"
            placeholder="Ex: الفاتحة ou Fatiha"
            value={options.suraName}
            onChange={(e) => setOptions({ ...options, suraName: e.target.value })}
            style={{marginLeft: '8px',padding: '4px 8px',border: '1px solid #ddd',borderRadius: '4px',fontSize: '0.9rem',width: '140px'}}
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
