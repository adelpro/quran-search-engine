import { BaseError } from './base-error';
import { ErrorCode, ErrorType } from './error-codes';

/**
 * Base class for tokenization errors
 */
export class TokenizationError extends BaseError {
  constructor(code: ErrorCode, message: string) {
    super(code, ErrorType.TOKENIZATION_ERROR, message);
    Object.setPrototypeOf(this, TokenizationError.prototype);
  }
}

/**
 * Thrown when morphology data is missing for a verse
 */
export class MissingMorphologyError extends TokenizationError {
  constructor(public gid: number) {
    super(
      ErrorCode.TOKENIZATION_MISSING_MORPHOLOGY,
      `Morphology data not found for verse GID: ${gid}`,
    );
    Object.setPrototypeOf(this, MissingMorphologyError.prototype);
  }
}

/**
 * Thrown when an invalid tokenization mode is provided
 */
export class InvalidModeError extends TokenizationError {
  constructor(public mode: string) {
    super(
      ErrorCode.TOKENIZATION_INVALID_MODE,
      `Invalid tokenization mode: "${mode}". Expected one of: text, lemma, root`,
    );
    Object.setPrototypeOf(this, InvalidModeError.prototype);
  }
}
