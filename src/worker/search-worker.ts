/* global self, postMessage */

import {
  loadQuranData,
  loadMorphology,
  loadWordMap,
  loadSemanticData,
  loadPhoneticData,
  buildInvertedIndex,
} from '../utils/loader';
import { search } from '../core/search';
import { LRUCache } from '../utils/lru-cache';
import type { QuranText, MorphologyAya, WordMap, SearchResponse, InvertedIndex } from '../types';
import type { WorkerRequest, InitDataResponse, SearchResultResponse, ErrorResponse } from './types';

// ── Worker-scoped state ────────────────────────────────────────

let quranData: Map<number, QuranText> | null = null;
let morphologyMap: Map<number, MorphologyAya> | null = null;
let wordMap: WordMap | null = null;
let semanticMap: Map<string, string[]> | null = null;
let phoneticMap: Map<string, string[]> | null = null;
let invertedIndex: InvertedIndex | null = null;
const cache = new LRUCache<string, SearchResponse<QuranText>>(100);

// ── Helpers ────────────────────────────────────────────────────

function postTyped(msg: InitDataResponse | SearchResultResponse<QuranText> | ErrorResponse): void {
  postMessage(msg);
}

// ── Message handler ────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT_DATA': {
      try {
        const [qd, morph, wm, semMap, phonMap] = await Promise.all([
          loadQuranData(),
          loadMorphology(),
          loadWordMap(),
          loadSemanticData().catch(() => null),
          loadPhoneticData().catch(() => null),
        ]);

        quranData = qd;
        morphologyMap = morph;
        wordMap = wm;
        semanticMap = semMap;
        phoneticMap = phonMap;
        invertedIndex = buildInvertedIndex(morphologyMap, quranData, semanticMap ?? undefined);

        postTyped({
          type: 'INIT_DATA_RESULT',
          requestId: msg.requestId,
          success: true,
        });
      } catch (err) {
        postTyped({
          type: 'INIT_DATA_RESULT',
          requestId: msg.requestId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'RUN_SEARCH': {
      const start = performance.now();

      if (!quranData || !morphologyMap || !wordMap) {
        postTyped({
          type: 'ERROR',
          requestId: msg.requestId,
          error: 'Worker data not initialized. Call INIT_DATA first.',
        });
        return;
      }

      try {
        const result = search(
          msg.query,
          {
            quranData,
            morphologyMap,
            wordMap,
            invertedIndex: invertedIndex ?? undefined,
            semanticMap: semanticMap ?? undefined,
            phoneticMap: phoneticMap ?? undefined,
          },
          msg.options,
          msg.pagination,
          undefined,
          cache,
        );

        postTyped({
          type: 'SEARCH_RESULT',
          requestId: msg.requestId,
          data: result,
          timingMs: performance.now() - start,
        });
      } catch (err) {
        postTyped({
          type: 'ERROR',
          requestId: msg.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case 'DISPOSE': {
      cache.clear();
      quranData = null;
      morphologyMap = null;
      wordMap = null;
      semanticMap = null;
      phoneticMap = null;
      invertedIndex = null;
      self.close();
      break;
    }
  }
};
