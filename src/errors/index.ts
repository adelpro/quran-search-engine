// Base error and types
export { BaseError } from './base.error';
export { ErrorCode, ErrorType } from './error-codes';

// Data loading errors
export {
  DataLoadError,
  DataFileNotFoundError,
  DataParseError,
  DataSchemaInvalidError,
} from './data-load.error';

// Search errors
export {
  SearchError,
  InvalidQueryError,
  MissingDependenciesError,
  SearchOperationFailedError,
} from './search.error';

// Validation errors
export {
  ValidationError,
  InvalidPaginationError,
  InvalidOptionsError,
  InvalidVerseStructureError,
} from './validation.error';

// Tokenization errors
export {
  TokenizationError,
  MissingMorphologyError,
  InvalidModeError,
  MissingWordMapError,
} from './tokenization.error';
