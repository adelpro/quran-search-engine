import { BaseError } from './base-error';
import { ErrorCode, ErrorType } from './error-codes';

/**
 * Base class for validation errors
 */
export class ValidationError extends BaseError {
  constructor(code: ErrorCode, message: string) {
    super(code, ErrorType.VALIDATION_ERROR, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when pagination parameters are invalid
 */
export class InvalidPaginationError extends ValidationError {
  constructor(
    public page?: number,
    public limit?: number,
  ) {
    super(
      ErrorCode.VALIDATION_INVALID_PAGINATION,
      `Invalid pagination parameters: page=${page}, limit=${limit}. Both must be positive numbers.`,
    );
    Object.setPrototypeOf(this, InvalidPaginationError.prototype);
  }
}

/**
 * Thrown when search options are invalid
 */
export class InvalidOptionsError extends ValidationError {
  constructor(public reason: string) {
    super(ErrorCode.VALIDATION_INVALID_OPTIONS, `Invalid search options: ${reason}`);
    Object.setPrototypeOf(this, InvalidOptionsError.prototype);
  }
}
