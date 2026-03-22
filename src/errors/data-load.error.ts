import { BaseError } from './base-error';
import { ErrorCode, ErrorType } from './error-codes';

/**
 * Base class for data loading errors
 */
export class DataLoadError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    public filePath?: string,
    public cause?: unknown,
  ) {
    super(code, ErrorType.DATA_ERROR, message);
    Object.setPrototypeOf(this, DataLoadError.prototype);
  }
}

/**
 * Thrown when a required data file is not found
 */
export class DataFileNotFoundError extends DataLoadError {
  constructor(filePath: string, cause?: unknown) {
    super(ErrorCode.DATA_FILE_NOT_FOUND, `Data file not found: ${filePath}`, filePath, cause);
    Object.setPrototypeOf(this, DataFileNotFoundError.prototype);
  }
}

/**
 * Thrown when a data file cannot be parsed
 */
export class DataParseError extends DataLoadError {
  constructor(filePath: string, cause?: unknown) {
    super(ErrorCode.DATA_PARSE_ERROR, `Failed to parse data file: ${filePath}`, filePath, cause);
    Object.setPrototypeOf(this, DataParseError.prototype);
  }
}

/**
 * Thrown when data file has invalid schema or structure
 */
export class DataSchemaInvalidError extends DataLoadError {
  constructor(filePath: string, details: string, cause?: unknown) {
    super(
      ErrorCode.DATA_SCHEMA_INVALID,
      `Invalid data schema in ${filePath}: ${details}`,
      filePath,
      cause,
    );
    Object.setPrototypeOf(this, DataSchemaInvalidError.prototype);
  }
}
