import { BaseError } from './base.error';
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
  constructor(gid: number) {
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
  constructor(mode: string) {
    super(
      ErrorCode.TOKENIZATION_INVALID_MODE,
      `Invalid tokenization mode: "${mode}". Expected one of: text, lemma, root`,
    );
    Object.setPrototypeOf(this, InvalidModeError.prototype);
  }
}

/**
 * Thrown when word map is required but missing
 */
export class MissingWordMapError extends TokenizationError {
  constructor(mode: string) {
    super(
      ErrorCode.TOKENIZATION_MISSING_WORD_MAP,
      `Word map is required for ${mode} mode tokenization`,
    );
    Object.setPrototypeOf(this, MissingWordMapError.prototype);
  }
}
