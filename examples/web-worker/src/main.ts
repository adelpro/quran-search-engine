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

  private searchInput: HTMLInputElement;
  private lemmaCheckbox: HTMLInputElement;
  private rootCheckbox: HTMLInputElement;
  private fuzzyCheckbox: HTMLInputElement;
  private resultsDiv: HTMLDivElement;

  constructor() {
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.lemmaCheckbox = document.getElementById('lemma') as HTMLInputElement;
    this.rootCheckbox = document.getElementById('root') as HTMLInputElement;
    this.fuzzyCheckbox = document.getElementById('fuzzy') as HTMLInputElement;
    this.resultsDiv = document.getElementById('results') as HTMLDivElement;

    this.worker = createSearchWorker();
    this.init();
    this.setupEventListeners();
  }

  private async init() {
    try {
      this.showLoading();
      await this.worker.init();
    } catch (error) {
      console.error('Failed to initialize search worker:', error);
      this.showError('Failed to load Quran data');
    } finally {
      this.loading = false;
      this.hideLoading();
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
    if (!query || this.loading) {
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
        <div>Found <strong>${response.pagination.totalResults}</strong> matches (via Web Worker)</div>
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
        </div>
      </div>
      ${response.results.map((verse) => this.renderVerse(verse)).join('')}
    `;

    this.resultsDiv.innerHTML = html;
  }

  private renderVerse(verse: ScoredQuranText) {
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

    return `
      <div class="verse-card">
        <div class="verse-header">
          <span>${verse.sura_name} (${verse.sura_id}:${verse.aya_id})</span>
          <span class="match-tag">${verse.matchType === 'none' ? 'fuzzy' : verse.matchType} (Score: ${verse.matchScore})</span>
        </div>
        <div class="verse-arabic">${highlightedText}</div>
      </div>
    `;
  }

  private showLoading() {
    this.resultsDiv.innerHTML = '<div class="loading">Loading Quranic datasets in Web Worker...</div>';
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
  new QuranSearchWorkerApp();
});
