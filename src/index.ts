export * from './types';
export * from './utils/normalization';
export * from './core/search';
export * from './core/tokenization';

// Re-export Fuse for convenience
import Fuse from 'fuse.js';
export { Fuse };
