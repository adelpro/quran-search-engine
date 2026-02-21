/**
 * Error codes for data loading operations
 */
export enum ErrorCode {
  // Data Loading Errors
  DATA_FILE_NOT_FOUND = 'DATA_FILE_NOT_FOUND',
  DATA_PARSE_ERROR = 'DATA_PARSE_ERROR',
  DATA_SCHEMA_INVALID = 'DATA_SCHEMA_INVALID',
}

/**
 * Error type for data loading errors
 */
export enum ErrorType {
  DATA_ERROR = 'DataError',
}
