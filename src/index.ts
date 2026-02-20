export type * from './types';

// Error classes and types
export * from './errors';

export { loadMorphology, loadQuranData, loadWordMap } from './utils/loader';
export { normalizeArabic, removeTashkeel, isArabic } from './utils/normalization';
export { getHighlightRanges, type HighlightRange } from './utils/highlight';
export { search, createArabicFuseSearch } from './core/search';
// export { search } from './core/search';
export { LRUCache } from './core/lru-cache';
