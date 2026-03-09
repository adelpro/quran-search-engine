import {
  createSearchWorker,
  type SearchWorkerClient,
  type SearchResponse,
  type ScoredQuranText,
  getHighlightRanges,
} from 'quran-search-engine';

class QuranSearchWorkerApp {
  private worker: SearchWorkerClient;
  private loading = true;
  private initialized = false;
  private pendingQuery = false;

  private searchInput: HTMLInputElement;
  private lemmaCheckbox: HTMLInputElement;
  private rootCheckbox: HTMLInputElement;
  private fuzzyCheckbox: HTMLInputElement;
  private resultsDiv: HTMLDivElement;

  constructor() {
    const searchInput = document.getElementById('search-input');
    const lemmaCheckbox = document.getElementById('lemma');
    const rootCheckbox = document.getElementById('root');
    const fuzzyCheckbox = document.getElementById('fuzzy');
    const resultsDiv = document.getElementById('results');

    if (!searchInput || !lemmaCheckbox || !rootCheckbox || !fuzzyCheckbox || !resultsDiv) {
      throw new Error('Required DOM elements not found');
    }

    this.searchInput = searchInput as HTMLInputElement;
    this.lemmaCheckbox = lemmaCheckbox as HTMLInputElement;
    this.rootCheckbox = rootCheckbox as HTMLInputElement;
    this.fuzzyCheckbox = fuzzyCheckbox as HTMLInputElement;
    this.resultsDiv = resultsDiv as HTMLDivElement;

    this.worker = createSearchWorker();
    this.init();
    this.setupEventListeners();
  }

  private async init() {
    let initSucceeded = false;
    try {
      this.showLoading();
      await this.worker.init();
      initSucceeded = true;
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize search worker:', error);
      this.showError('Failed to load Quran data');
    } finally {
      this.loading = false;
      this.hideLoading();
      if (initSucceeded && this.pendingQuery) {
        this.pendingQuery = false;
        void this.handleSearch();
      }
    }
  }

  private setupEventListeners() {
    this.searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    this.lemmaCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.rootCheckbox.addEventListener('change', this.handleSearch.bind(this));
    this.fuzzyCheckbox.addEventListener('change', this.handleSearch.bind(this));
  }

  private debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  private async handleSearch() {
    const query = this.searchInput.value.trim();
    if (this.loading) {
      if (query) this.pendingQuery = true;
      return;
    }
    if (!this.initialized) return;
    if (!query) {
      this.resultsDiv.innerHTML = '';
      return;
    }

    const options = {
      lemma: this.lemmaCheckbox.checked,
      root: this.rootCheckbox.checked,
      fuzzy: this.fuzzyCheckbox.checked,
    };

    try {
      const response = await this.worker.search(query, options, { page: 1, limit: 20 });
      this.renderResults(response);
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Search failed');
    }
  }

  private renderResults(response: SearchResponse) {
    if (!response.results.length) {
      this.resultsDiv.innerHTML = '<p>No results found.</p>';
      return;
    }

    const html = `
      <div class="results-info">
        <div>Found <strong>${Number(response.pagination.totalResults)}</strong> matches</div>
        <div class="stats">
          <span class="stat-item">
            <span class="indicator indicator-exact"></span>
            <span>Exact: ${Number(response.counts.simple)}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-lemma"></span>
            <span>Lemma: ${Number(response.counts.lemma)}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-root"></span>
            <span>Root: ${Number(response.counts.root)}</span>
          </span>
          <span class="stat-item">
            <span class="indicator indicator-fuzzy"></span>
            <span>Fuzzy: ${Number(response.counts.fuzzy)}</span>
          </span>
        </div>
      </div>
      ${response.results.map((verse) => this.renderVerse(verse)).join('')}
    `;

    this.resultsDiv.innerHTML = html;
  }

  private static readonly VALID_MATCH_TYPES = new Set(['exact', 'lemma', 'root', 'fuzzy', 'none']);

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private safeMatchType(matchType: string): string {
    return QuranSearchWorkerApp.VALID_MATCH_TYPES.has(matchType) ? matchType : 'unknown';
  }

  private renderVerse(verse: ScoredQuranText) {
    const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
    let highlightedText = this.escapeHtml(verse.uthmani);

    if (ranges.length > 0) {
      const parts: string[] = [];
      let cursor = 0;

      for (const range of ranges) {
        if (cursor < range.start) {
          parts.push(this.escapeHtml(verse.uthmani.slice(cursor, range.start)));
        }
        const segment = this.escapeHtml(verse.uthmani.slice(range.start, range.end));
        parts.push(
          `<span class="highlight-${this.safeMatchType(range.matchType)}">${segment}</span>`,
        );
        cursor = range.end;
      }

      if (cursor < verse.uthmani.length) {
        parts.push(this.escapeHtml(verse.uthmani.slice(cursor)));
      }

      highlightedText = parts.join('');
    }

    return `
      <div class="verse-card">
        <div class="verse-header">
          <span>${this.escapeHtml(verse.sura_name)} (${verse.sura_id}:${verse.aya_id})</span>
          <span class="match-tag">${this.escapeHtml(verse.matchType === 'none' ? 'fuzzy' : verse.matchType)} (Score: ${Number(verse.matchScore)})</span>
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
    this.resultsDiv.innerHTML = `<div style="color: red; padding: 20px;">${this.escapeHtml(message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new QuranSearchWorkerApp();
});
