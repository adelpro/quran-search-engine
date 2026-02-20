import { BaseError } from './base.error';
import { ErrorCode, ErrorType } from './error-codes';

/**
 * Base class for search-related errors
 */
export class SearchError extends BaseError {
  constructor(code: ErrorCode, message: string) {
    super(code, ErrorType.SEARCH_ERROR, message);
    Object.setPrototypeOf(this, SearchError.prototype);
  }
}

/**
 * Thrown when search query is invalid or empty
 */
export class InvalidQueryError extends SearchError {
  constructor(query: string, reason?: string) {
    const message = reason
      ? `Invalid search query "${query}": ${reason}`
      : `Invalid search query: "${query}"`;
    super(ErrorCode.SEARCH_INVALID_QUERY, message);
    Object.setPrototypeOf(this, InvalidQueryError.prototype);
  }
}

/**
 * Thrown when required search dependencies are missing
 */
export class MissingDependenciesError extends SearchError {
  constructor(dependencies: string[]) {
    super(
      ErrorCode.SEARCH_MISSING_DEPENDENCIES,
      `Missing required dependencies for search: ${dependencies.join(', ')}`,
    );
    Object.setPrototypeOf(this, MissingDependenciesError.prototype);
  }
}

/**
 * Thrown when a search operation fails
 */
export class SearchOperationFailedError extends SearchError {
  constructor(operation: string, cause?: unknown) {
    const message = `Search operation "${operation}" failed${
      cause instanceof Error ? `: ${cause.message}` : ''
    }`;
    super(ErrorCode.SEARCH_OPERATION_FAILED, message);
    Object.setPrototypeOf(this, SearchOperationFailedError.prototype);
  }
}
