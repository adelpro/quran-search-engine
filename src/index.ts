export * from './types';
export * from './utils/normalization';
export * from './core/search';
export { loadMorphology, loadWordMap, loadQuranData } from './utils/loader';

// Re-export Fuse for convenience
import Fuse from 'fuse.js';
export { Fuse };
