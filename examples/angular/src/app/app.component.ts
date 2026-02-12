import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  getHighlightRanges,
  loadMorphology,
  loadQuranData,
  loadWordMap,
  search,
  type AdvancedSearchOptions,
  type MatchType,
  type MorphologyAya,
  type QuranText,
  type ScoredVerse,
  type SearchResponse,
  type WordMap,
} from 'quran-search-engine';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type HighlightPart = { text: string; matchType: MatchType | null };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page">
      <header class="header">
        <h1 class="title">Quran Search Engine</h1>
        <p class="subtitle">Angular example (workspace dependency)</p>
      </header>

      <section class="panel" aria-label="Search controls">
        <label class="label" for="query">Arabic query</label>
        <div class="row">
          <input
            class="input"
            id="query"
            name="query"
            type="text"
            inputmode="text"
            autocomplete="off"
            spellcheck="false"
            [disabled]="loadState !== 'ready'"
            [(ngModel)]="query"
            (ngModelChange)="onQueryChange()"
            placeholder="مثال: الرحمن"
          />
          <button class="button" type="button" (click)="runSearch(true)" [disabled]="loadState !== 'ready'">
            Search
          </button>
        </div>

        <fieldset class="fieldset" [disabled]="loadState !== 'ready'">
          <legend class="legend">Options</legend>
          <label class="check">
            <input type="checkbox" [(ngModel)]="options.lemma" (ngModelChange)="runSearch(true)" />
            Lemma
          </label>
          <label class="check">
            <input type="checkbox" [(ngModel)]="options.root" (ngModelChange)="runSearch(true)" />
            Root
          </label>
          <label class="check">
            <input type="checkbox" [(ngModel)]="options.fuzzy" (ngModelChange)="runSearch(true)" />
            Fuzzy
          </label>
          <label class="label">
            Sura ID:
            <input type="number" class="input" style="width: 80px;" 
                  [(ngModel)]="options.suraId" (ngModelChange)="runSearch(true)" />
          </label>
  
          <label class="label">
            Juz ID:
              <input type="number" class="input" style="width: 80px;" 
                  [(ngModel)]="options.juzId" (ngModelChange)="runSearch(true)" />
          </label>
          <label class="label">
            Sura Name:
            <input type="text" class="input" style="width: 150px;" 
                  placeholder="Ex: الفاتحة"
                  [(ngModel)]="options.suraName" (ngModelChange)="runSearch(true)" />
          </label>
        </fieldset>
      </section>

      <section class="panel" aria-label="Results">
        <div *ngIf="loadState === 'loading'" class="muted">Loading Quran datasets…</div>
        <div *ngIf="loadState === 'error'" class="error" role="alert">
          {{ errorMessage }}
        </div>

        <ng-container *ngIf="loadState === 'ready'">
          <div *ngIf="!response" class="muted">Type an Arabic query to see results.</div>

          <ng-container *ngIf="response">
            <div class="meta">
              <div class="counts">
                Total: <strong>{{ response.counts.total }}</strong> • Exact:
                <strong>{{ response.counts.simple }}</strong> • Lemma:
                <strong>{{ response.counts.lemma }}</strong> • Root:
                <strong>{{ response.counts.root }}</strong> • Fuzzy:
                <strong>{{ response.counts.fuzzy }}</strong>
              </div>
              <div class="pager" aria-label="Pagination controls">
                <button
                  class="button secondary"
                  type="button"
                  (click)="goToPage(page - 1)"
                  [disabled]="page <= 1"
                >
                  Prev
                </button>
                <span class="muted">Page {{ page }} / {{ response.pagination.totalPages || 1 }}</span>
                <button
                  class="button secondary"
                  type="button"
                  (click)="goToPage(page + 1)"
                  [disabled]="page >= (response.pagination.totalPages || 1)"
                >
                  Next
                </button>
              </div>
            </div>

            <ol class="list">
              <li *ngFor="let verse of response.results; trackBy: trackByGid" class="item">
                <div class="itemHead">
                  <span class="badge" [attr.data-type]="verse.matchType">{{ verse.matchType }}</span>
                  <span class="ref">{{ verse.sura_name_en }} • {{ verse.aya_id_display }}</span>
                  <span class="score">score {{ verse.matchScore }}</span>
                </div>
                <p class="text arabic" dir="rtl">
                  <span
                    *ngFor="let part of getUthmaniParts(verse)"
                    [class]="part.matchType ? 'highlight-' + part.matchType : ''"
                  >
                    {{ part.text }}
                  </span>
                </p>
                <p class="text muted">{{ verse.standard }}</p>
              </li>
            </ol>
          </ng-container>
        </ng-container>
      </section>
    </main>
  `,
  styles: [
    `
      .page {
        max-width: 980px;
        margin: 0 auto;
        padding: 24px 16px 56px;
      }
      .header {
        margin-bottom: 16px;
      }
      .title {
        margin: 0;
        font-size: 28px;
        line-height: 1.2;
      }
      .subtitle {
        margin: 6px 0 0;
        color: #9fb0c0;
      }
      .panel {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 14px;
        margin-top: 14px;
      }
      .label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
      }
      .input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(0, 0, 0, 0.25);
        color: inherit;
      }
      .button {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
        cursor: pointer;
      }
      .button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .button.secondary {
        padding: 8px 10px;
        background: transparent;
      }
      .fieldset {
        margin-top: 12px;
        padding: 10px 12px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .legend {
        padding: 0 6px;
        color: #9fb0c0;
      }
      .check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-right: 12px;
      }
      .muted {
        color: #9fb0c0;
      }
      .error {
        color: #ffb4b4;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .pager {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .list {
        margin: 0;
        padding: 0 0 0 18px;
      }
      .item {
        margin: 0 0 14px;
        padding: 12px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .itemHead {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .badge {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ref {
        font-weight: 600;
      }
      .score {
        margin-left: auto;
        color: #9fb0c0;
      }
      .text {
        margin: 0;
        line-height: 1.8;
      }
      .arabic {
        font-size: 22px;
      }
      .highlight-exact,
      .highlight-lemma,
      .highlight-root,
      .highlight-fuzzy {
        padding: 0 2px;
        border-radius: 4px;
      }
      .highlight-exact {
        background: rgba(255, 193, 7, 0.35);
      }
      .highlight-lemma {
        background: rgba(23, 162, 184, 0.35);
      }
      .highlight-root {
        background: rgba(40, 167, 69, 0.35);
      }
      .highlight-fuzzy {
        background: rgba(220, 53, 69, 0.35);
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  loadState: LoadState = 'idle';
  errorMessage = '';

  query = '';
  page = 1;
  limit = 20;

  options: { lemma: boolean; root: boolean; fuzzy: boolean ;suraId?: number; juzId?: number; suraName?: string; } = {
    lemma: true,
    root: true,
    fuzzy: true,

  };

  response: SearchResponse<QuranText> | null = null;

  private quranData: QuranText[] | null = null;
  private morphologyMap: Map<number, MorphologyAya> | null = null;
  private wordMap: WordMap | null = null;
  private uthmaniHighlightPartsByGid = new Map<number, readonly HighlightPart[]>();

  private debounceHandle: number | null = null;

  async ngOnInit(): Promise<void> {
    this.loadState = 'loading';
    this.errorMessage = '';

    try {
      const [quranData, morphologyMap, wordMap] = await Promise.all([
        loadQuranData(),
        loadMorphology(),
        loadWordMap(),
      ]);

      this.quranData = quranData;
      this.morphologyMap = morphologyMap;
      this.wordMap = wordMap;
      this.loadState = 'ready';
    } catch (err: unknown) {
      this.loadState = 'error';
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load datasets.';
    }
  }

  ngOnDestroy(): void {
    if (this.debounceHandle !== null) {
      window.clearTimeout(this.debounceHandle);
    }
  }

  onQueryChange(): void {
    if (this.debounceHandle !== null) {
      window.clearTimeout(this.debounceHandle);
    }

    this.debounceHandle = window.setTimeout(() => {
      this.runSearch(true);
    }, 250);
  }

  runSearch(resetPage: boolean): void {
    if (!this.quranData || !this.morphologyMap || !this.wordMap) return;

    const trimmed = this.query.trim();
    if (!trimmed) {
      this.response = null;
      this.uthmaniHighlightPartsByGid.clear();
      return;
    }

    if (resetPage) this.page = 1;

    const searchOptions: AdvancedSearchOptions = {
      lemma: this.options.lemma,
      root: this.options.root,
      fuzzy: this.options.fuzzy,
      //+
      suraId: this.options.suraId,
      juzId: this.options.juzId,
      suraName: this.options.suraName,
    };

    this.response = search(
      trimmed,
      this.quranData,
      this.morphologyMap,
      this.wordMap,
      searchOptions,
      { page: this.page, limit: this.limit },
    );

    this.rebuildHighlightCache();
  }

  goToPage(nextPage: number): void {
    const target = Math.max(1, nextPage);
    if (target === this.page) return;
    this.page = target;
    this.runSearch(false);
  }

  trackByGid(_: number, verse: QuranText): number {
    return verse.gid;
  }

  getUthmaniParts(verse: ScoredVerse<QuranText>): readonly HighlightPart[] {
    return (
      this.uthmaniHighlightPartsByGid.get(verse.gid) ?? [{ text: verse.uthmani, matchType: null }]
    );
  }

  private rebuildHighlightCache(): void {
    this.uthmaniHighlightPartsByGid.clear();
    if (!this.response) return;

    for (const verse of this.response.results) {
      const parts = this.buildHighlightParts(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
      this.uthmaniHighlightPartsByGid.set(verse.gid, parts);
    }
  }

  private buildHighlightParts(
    text: string,
    matchedTokens: readonly string[],
    tokenTypes?: Record<string, MatchType>,
  ): readonly HighlightPart[] {
    const ranges = getHighlightRanges(text, matchedTokens, tokenTypes);
    if (ranges.length === 0) return [{ text, matchType: null }];

    const parts: HighlightPart[] = [];
    let cursor = 0;

    for (const range of ranges) {
      if (cursor < range.start) {
        parts.push({ text: text.slice(cursor, range.start), matchType: null });
      }

      parts.push({ text: text.slice(range.start, range.end), matchType: range.matchType });
      cursor = range.end;
    }

    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), matchType: null });
    }

    return parts;
  }
}
