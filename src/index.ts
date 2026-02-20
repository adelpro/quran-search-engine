export type * from './types';

export { loadMorphology, loadQuranData, loadWordMap } from './utils/loader';
export { normalizeArabic, removeTashkeel } from './utils/normalization';
export { transliterate, isLatinInput } from './utils/transliteration';
export { getHighlightRanges, type HighlightRange } from './utils/highlight';
export { search, createArabicFuseSearch } from './core/search';
// export { search } from './core/search';
export { LRUCache } from './core/lru-cache';
