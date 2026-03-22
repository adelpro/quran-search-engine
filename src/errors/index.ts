// Base error and types
export { BaseError } from './base-error';
export { ErrorCode, ErrorType } from './error-codes';

export {
  DataLoadError,
  DataFileNotFoundError,
  DataParseError,
  DataSchemaInvalidError,
} from './data-load.error';

export {
  SearchError,
  InvalidQueryError,
  MissingDependenciesError,
  SearchOperationFailedError,
  InvalidRegexError,
} from './search-error';

export { ValidationError, InvalidPaginationError, InvalidOptionsError } from './validation-error';

export { TokenizationError, MissingMorphologyError, InvalidModeError } from './tokenization-error';

export {
  WorkerError,
  WorkerNotSupportedError,
  WorkerInitializationError,
  WorkerTerminatedError,
  WorkerNotInitializedError,
  WorkerFactoryError,
} from './worker-error';
