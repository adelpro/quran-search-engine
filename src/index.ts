export type * from './types';

export { loadMorphology, loadQuranData, loadWordMap } from './utils/loader';
export { normalizeArabic, removeTashkeel } from './utils/normalization';
export { getHighlightRanges, type HighlightRange } from './utils/highlight';
export { search, createArabicFuseSearch } from './core/search';
