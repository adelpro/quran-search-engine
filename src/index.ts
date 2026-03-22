export type * from './types';

export {
  loadMorphology,
  loadQuranData,
  loadWordMap,
  buildInvertedIndex,
  loadSemanticData,
  loadPhoneticData,
} from './utils/loader';
export { normalizeArabic, removeTashkeel, isArabic } from './utils/normalization';

export * from './errors';
export { getHighlightRanges, type HighlightRange } from './utils/highlight';
export { search } from './core/search';
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
export { hasBooleanOperators, clearBooleanOperators } from './core/layers/boolean-search';

export {
  createSearchWorker,
  supportsWorkers,
  type CreateSearchWorkerOptions,
  type FallbackDependencies,
  type SearchWorkerClient,
} from './worker';

export { SURAS } from './utils/suras';
