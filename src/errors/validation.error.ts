import { BaseError } from './base.error';
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
 * Thrown when input text is not Arabic
 */
export class NonArabicInputError extends ValidationError {
  constructor(input: string) {
    super(
      ErrorCode.VALIDATION_NON_ARABIC_INPUT,
      `Input must contain Arabic characters: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`,
    );
    Object.setPrototypeOf(this, NonArabicInputError.prototype);
  }
}

/**
 * Thrown when pagination parameters are invalid
 */
export class InvalidPaginationError extends ValidationError {
  constructor(page?: number, limit?: number) {
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
  constructor(reason: string) {
    super(ErrorCode.VALIDATION_INVALID_OPTIONS, `Invalid options: ${reason}`);
    Object.setPrototypeOf(this, InvalidOptionsError.prototype);
  }
}

/**
 * Thrown when verse structure is malformed
 */
export class InvalidVerseStructureError extends ValidationError {
  constructor(details: string) {
    super(ErrorCode.VALIDATION_INVALID_VERSE_STRUCTURE, `Invalid verse structure: ${details}`);
    Object.setPrototypeOf(this, InvalidVerseStructureError.prototype);
  }
}
