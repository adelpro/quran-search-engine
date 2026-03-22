import { BaseError } from './base-error';
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
 * Thrown when a search query is invalid or empty
 */
export class InvalidQueryError extends SearchError {
  constructor(
    public query: string,
    details?: string,
  ) {
    const message = details
      ? `Invalid search query "${query}": ${details}`
      : `Invalid search query: "${query}"`;
    super(ErrorCode.SEARCH_INVALID_QUERY, message);
    Object.setPrototypeOf(this, InvalidQueryError.prototype);
  }
}

/**
 * Thrown when required search dependencies are missing
 */
export class MissingDependenciesError extends SearchError {
  constructor(public missingDependencies: string[]) {
    super(
      ErrorCode.SEARCH_MISSING_DEPENDENCIES,
      `Missing required dependencies for search: ${missingDependencies.join(', ')}`,
    );
    Object.setPrototypeOf(this, MissingDependenciesError.prototype);
  }
}

/**
 * Thrown when a search operation fails unexpectedly
 */
export class SearchOperationFailedError extends SearchError {
  constructor(
    public operation: string,
    public cause?: unknown,
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      ErrorCode.SEARCH_OPERATION_FAILED,
      `Search operation "${operation}" failed: ${causeMessage}`,
    );
    Object.setPrototypeOf(this, SearchOperationFailedError.prototype);
  }
}

/**
 * Thrown when a regex pattern is syntactically invalid or unsafe (ReDoS risk)
 */
export class InvalidRegexError extends SearchError {
  constructor(
    public pattern: string,
    public reason: string,
  ) {
    super(ErrorCode.SEARCH_INVALID_REGEX, `Invalid regex pattern "${pattern}": ${reason}`);
    Object.setPrototypeOf(this, InvalidRegexError.prototype);
  }
}
