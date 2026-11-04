import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadPhoneticData,
  loadSubjectData,
  buildInvertedIndex,
  search,
  LRUCache,
  createSearchWorker,
  supportsWorkers,
  hasBooleanOperators,
  type QuranText,
  type MorphologyAya,
  type WordMap,
  type InvertedIndex,
  type SearchResponse,
  type MultiTermResponse,
  type RankBy,
  type SearchWorkerClient,
  type ScoredVerse,
  type MergedSearchResult,
  getHighlightRanges,
} from 'quran-search-engine';

type AnySearchResponse = SearchResponse<QuranText> | MultiTermResponse<QuranText>;

// A leading `sura:aya` / `sura:aya-aya` prefix means the string overload must
// stay in charge so the v0.4.0 range-scoped text pipeline runs.
const RANGE_PREFIX = /^\d{1,3}:\d{0,3}(?:-\d{1,3})?(?:\s|$)/;
function isRangeScopedQuery(query: string): boolean {
  return RANGE_PREFIX.test(query.trim());
}

class QuranSearchApp {
  private quranData: Map<number, QuranText> | null = null;
  private morphologyMap: Map<number, MorphologyAya> | null = null;
  private wordMap: WordMap | null = null;
  private semanticMap: Map<string, string[]> | null = null;
  private phoneticMap: Map<string, string[]> | null = null;
  private subjectMap: Map<string, string[]> | null = null;
  private invertedIndex: InvertedIndex | null = null;
  private loading = true;
  private cache = new LRUCache<string, SearchResponse<QuranText>>(50);
  private workerClient: SearchWorkerClient | null = null;
  private usingWorker = false;
  /** Invalidates async worker responses that arrive after a newer query. */
  private searchRequestId = 0;
  private indexStats: {
    lemmaCount: number;
    rootCount: number;
    wordCount: number;
    semanticCount: number;
    subjectCount: number;
  } | null = null;
  private indexBuildTime: number | null = null;

  private searchInput: HTMLInputElement;
  private lemmaCheckbox: HTMLInputElement;
  private rootCheckbox: HTMLInputElement;
  private fuzzyCheckbox: HTMLInputElement;
  private isRegexCheckbox: HTMLInputElement;
  private suraIdInput: HTMLInputElement;
  private juzIdInput: HTMLInputElement;
  private semanticCheckbox: HTMLInputElement;
  private subjectCheckbox: HTMLInputElement;
  private suraNameInput: HTMLInputElement;
  private rankOption: HTMLLabelElement;
  private rankSelect: HTMLSelectElement;
  private resultsDiv: HTMLDivElement;
  private statsDiv: HTMLDivElement;
  private workerBadge: HTMLSpanElement;

  constructor() {
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.lemmaCheckbox = document.getElementById('lemma') as HTMLInputElement;
    this.rootCheckbox = document.getElementById('root') as HTMLInputElement;
    this.fuzzyCheckbox = document.getElementById('fuzzy') as HTMLInputElement;
    this.isRegexCheckbox = document.getElementById('is-regex') as HTMLInputElement;
    this.semanticCheckbox = document.getElementById('semantic') as HTMLInputElement;
    this.subjectCheckbox = document.getElementById('subject') as HTMLInputElement;
    this.suraIdInput = document.getElementById('sura-id') as HTMLInputElement;
    this.juzIdInput = document.getElementById('juz-id') as HTMLInputElement;
    this.suraNameInput = document.getElementById('sura-name') as HTMLInputElement;
    this.rankOption = document.getElementById('rank-option') as HTMLLabelElement;
    this.rankSelect = document.getElementById('rank-by') as HTMLSelectElement;
    this.resultsDiv = document.getElementById('results') as HTMLDivElement;
    this.statsDiv = document.getElementById('stats') as HTMLDivElement;
    this.workerBadge = document.getElementById('worker-badge') as HTMLSpanElement;

    this.init();
    this.setupEventListeners();
  }

  private async init() {
    try {
      this.showLoading();

      if (supportsWorkers()) {
        try {
          const client = createSearchWorker({
            workerUrl: new URL('quran-search-engine/worker', import.meta.url),
          });
          await client.initData();
          this.workerClient = client;
          this.usingWorker = true;
          this.updateWorkerBadge();
        } catch (err) {
          console.warn('Web Worker init failed, falling back to main thread:', err);
        }
      }

      if (!this.workerClient) {
        const [data, morphology, dictionary, semantic, phonetic, subject] = await Promise.all([
          loadQuranData(),
          loadMorphology(),
          loadWordMap(),
          loadSemanticData(),
          loadPhoneticData(),
          loadSubjectData(),
        ]);
        this.quranData = data;
        this.morphologyMap = morphology;
        this.wordMap = dictionary;
        this.semanticMap = semantic;
        this.phoneticMap = phonetic;
        this.subjectMap = subject;

        const buildStart = performance.now();
        this.invertedIndex = buildInvertedIndex(morphology, data, semantic, subject, dictionary);
        this.indexBuildTime = performance.now() - buildStart;

        this.indexStats = {
          lemmaCount: this.invertedIndex.lemmaIndex.size,
          rootCount: this.invertedIndex.rootIndex.size,
          wordCount: this.invertedIndex.wordIndex.size,
          semanticCount: this.invertedIndex.semanticIndex?.size ?? 0,
          subjectCount: this.invertedIndex.subjectIndex?.size ?? 0,
        };
        this.updateStats();
      } else {
        const [data, morphology, dictionary, semantic, , subject] = await Promise.all([
          loadQuranData(),
          loadMorphology(),
          loadWordMap(),
          loadSemanticData(),
          loadPhoneticData(),
          loadSubjectData(),
        ]);
        this.subjectMap = subject;

        const buildStart = performance.now();
        const index = buildInvertedIndex(morphology, data, semantic, subject, dictionary);
        this.indexBuildTime = performance.now() - buildStart;

        this.indexStats = {
          lemmaCount: index.lemmaIndex.size,
          rootCount: index.rootIndex.size,
          wordCount: index.wordIndex.size,
          semanticCount: index.semanticIndex?.size ?? 0,
          subjectCount: index.subjectIndex?.size ?? 0,
        };
        this.updateStats();
      }
    } catch (error) {
      console.error('Failed to load Quran data:', error);
      this.showError('Failed to load Quran data');
    } finally {
      this.loading = false;
      this.hideLoading();
    }
  }

  private updateWorkerBadge() {
    if (this.workerBadge) {
      this.workerBadge.textContent = this.usingWorker
        ? 'Running on Web Worker'
        : 'Running on Main Thread';
      this.workerBadge.className = `worker-badge ${this.usingWorker ? 'worker-badge--active' : 'worker-badge--fallback'}`;
    }
  }

  private updateStats() {
    if (this.statsDiv && this.indexStats && this.indexBuildTime !== null) {
      this.statsDiv.innerHTML = `
        <strong>${this.indexStats.lemmaCount.toLocaleString()}</strong> lemmas ·
        <strong>${this.indexStats.rootCount.toLocaleString()}</strong> roots ·
        <strong>${this.indexStats.wordCount.toLocaleString()}</strong> words ·
        <strong>${this.indexStats.semanticCount.toLocaleString()}</strong> semantic ·
        <strong>${this.indexStats.subjectCount.toLocaleString()}</strong> subject ·
        Index: ${this.indexBuildTime.toFixed(1)}ms
      `;
    }
  }

  private setupEventListeners() {
    this.searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    this.lemmaCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.rootCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.fuzzyCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.isRegexCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.semanticCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.subjectCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.suraIdInput.addEventListener('change', this.handleSearch.bind(this));
    this.juzIdInput.addEventListener('change', this.handleSearch.bind(this));
    this.suraNameInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    this.rankSelect.addEventListener('change', this.handleSearch.bind(this));
  }

  private debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: number;
    return ((...args: unknown[]) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    }) as T;
  }

  private async handleSearch() {
    const query = this.searchInput.value.trim();
    if (!query || this.loading) {
      this.searchRequestId++;
      this.resultsDiv.innerHTML = '';
      return;
    }

    const requestId = ++this.searchRequestId;

    // v0.4.0 multi-term mode: 2+ whitespace-separated words are searched
    // independently via search(terms: string[]) and merged by verse gid.
    // Boolean queries and range-scoped text keep the string overload, and
    // regex mode is never split.
    const terms = query.split(/\s+/).filter(Boolean);

    const options = {
      lemma: this.lemmaCheckbox.checked,
      root: this.rootCheckbox.checked,
      fuzzy: this.fuzzyCheckbox.checked,
      isRegex: this.isRegexCheckbox.checked,
      semantic: this.semanticCheckbox.checked,
      subject: this.subjectCheckbox.checked,
      suraId: this.suraIdInput.value ? parseInt(this.suraIdInput.value, 10) : undefined,
      juzId: this.juzIdInput.value ? parseInt(this.juzIdInput.value, 10) : undefined,
      suraName: this.suraNameInput.value || undefined,
    };
    const isMultiTerm =
      terms.length > 1 &&
      !options.isRegex &&
      !hasBooleanOperators(query) &&
      !isRangeScopedQuery(query);
    this.rankOption.classList.toggle('rank-option--visible', isMultiTerm);
    const rankBy = this.rankSelect.value as RankBy;

    try {
      let response: AnySearchResponse;

      if (this.workerClient) {
        response = isMultiTerm
          ? await this.workerClient.runSearchMany(terms, options, {
              page: 1,
              limit: 20,
              rankBy,
            })
          : await this.workerClient.runSearch(query, options, { page: 1, limit: 20 });
      } else if (
        this.quranData &&
        this.morphologyMap &&
        this.wordMap &&
        this.semanticMap &&
        this.phoneticMap &&
        this.invertedIndex
      ) {
        const context = {
          quranData: this.quranData,
          morphologyMap: this.morphologyMap,
          wordMap: this.wordMap,
          semanticMap: this.semanticMap,
          phoneticMap: this.phoneticMap,
          subjectMap: this.subjectMap ?? undefined,
          invertedIndex: this.invertedIndex,
        };

        response = isMultiTerm
          ? search(terms, context, options, { page: 1, limit: 20, rankBy }, undefined, this.cache)
          : search(query, context, options, { page: 1, limit: 20 }, undefined, this.cache);
      } else {
        throw new Error('Data not loaded');
      }

      if (requestId !== this.searchRequestId) return;
      this.renderResults(response);
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Search failed');
    }
  }

  private renderResults(response: AnySearchResponse) {
    if (!response.results.length) {
      this.resultsDiv.innerHTML = '<p>No results found.</p>';
      return;
    }

    const html = `
      <div class="results-info">
        <div>Found <strong>${response.pagination.totalResults}</strong> matches</div>
        <div class="stats">
          <span class="stat-item">
            <span class="indicator indicator-exact"></span>
            <span>Exact: ${response.counts.simple}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-lemma"></span>
            <span>Lemma: ${response.counts.lemma}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-root"></span>
            <span>Root: ${response.counts.root}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-fuzzy"></span>
            <span>Fuzzy: ${response.counts.fuzzy}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-semantic"></span>
            <span>Semantic: ${response.counts.semantic}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-subject"></span>
            <span>Subject: ${response.counts.subject}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-semantic"></span>
            <span>Range: ${response.counts.range}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-semantic"></span>
            <span>Regex: ${response.counts.regex}</span>
          </span>
        </div>
      </div>
      ${response.results.map((verse) => this.renderVerse(verse)).join('')}
    `;

    this.resultsDiv.innerHTML = html;
  }

  private renderVerse(verse: ScoredVerse<QuranText>) {
    const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
    let highlightedText = verse.uthmani;

    if (ranges.length > 0) {
      const parts: string[] = [];
      let cursor = 0;

      for (const range of ranges) {
        if (cursor < range.start) {
          parts.push(verse.uthmani.slice(cursor, range.start));
        }
        const segment = verse.uthmani.slice(range.start, range.end);
        parts.push(`<span class="highlight-${range.matchType}">${segment}</span>`);
        cursor = range.end;
      }

      if (cursor < verse.uthmani.length) {
        parts.push(verse.uthmani.slice(cursor));
      }

      highlightedText = parts.join('');
    }

    const matchType = verse.matchType ?? 'none';
    const merged = 'matchedTerms' in verse ? (verse as MergedSearchResult<QuranText>) : null;
    const multiTermMeta = merged
      ? `<span>${merged.distinctTermCount} term(s) · ${merged.totalFrequency} hit(s)</span>`
      : '';

    return `
      <div class="verse-card">
        <div class="verse-header">
          <span>${verse.sura_name} (${verse.sura_id}:${verse.aya_id})</span>
          <span class="match-tag">${matchType === 'none' ? 'fuzzy' : matchType} (Score: ${verse.matchScore ?? 0})</span>
          ${multiTermMeta}
        </div>
        <div class="verse-arabic">${highlightedText}</div>
      </div>
    `;
  }

  private showLoading() {
    this.resultsDiv.innerHTML = '<div class="loading">Loading Quranic datasets...</div>';
  }

  private hideLoading() {
    if (this.resultsDiv.querySelector('.loading')) {
      this.resultsDiv.innerHTML = '';
    }
  }

  private showError(message: string) {
    this.resultsDiv.innerHTML = `<div style="color: red; padding: 20px;">${message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new QuranSearchApp();
});
