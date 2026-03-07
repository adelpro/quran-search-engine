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
export { search } from './core/search';
export { createSearchWorker, type SearchWorkerClient } from './worker';
export type { WorkerRequest, WorkerResponse } from './worker';
export { createArabicFuseSearch } from './core/layers/fuse-search';
export { validateRegex } from './utils/regex-validation';
export { LRUCache } from './utils/lru-cache';
export {
  validateQuranData,
  validateMorphologyData,
  validateWordMapData,
  validateSemanticData,
  formatSchemaErrors,
  type SchemaError,
  type ValidationResult,
} from './utils/schema';
