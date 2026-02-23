export type * from './types';

export {
  loadMorphology,
  loadQuranData,
  loadWordMap,
  buildInvertedIndex,
  loadInvertedIndex,
} from './utils/loader';
export { normalizeArabic, removeTashkeel, isArabic } from './utils/normalization';
// Error classes and types
export * from './errors';
export { getHighlightRanges, type HighlightRange } from './utils/highlight';
export { search, createArabicFuseSearch } from './core/search';
export { LRUCache } from './core/lru-cache';
// Error classes and types
export * from './errors';
