import { describe, it, expect } from 'vitest';
import {
  TokenizationError,
  MissingMorphologyError,
  InvalidModeError,
  MissingWordMapError,
} from './tokenization.error';
import { ErrorCode, ErrorType } from './error-codes';

describe('TokenizationError', () => {
  describe('MissingMorphologyError', () => {
    it('should create error with verse GID', () => {
      const error = new MissingMorphologyError(1234);

      expect(error).toBeInstanceOf(TokenizationError);
      expect(error.code).toBe(ErrorCode.TOKENIZATION_MISSING_MORPHOLOGY);
      expect(error.type).toBe(ErrorType.TOKENIZATION_ERROR);
      expect(error.message).toContain('1234');
      expect(error.message).toContain('Morphology data not found');
    });
  });

  describe('InvalidModeError', () => {
    it('should create error with invalid mode', () => {
      const error = new InvalidModeError('invalid');

      expect(error).toBeInstanceOf(TokenizationError);
      expect(error.code).toBe(ErrorCode.TOKENIZATION_INVALID_MODE);
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('text, lemma, root');
    });
  });

  describe('MissingWordMapError', () => {
    it('should create error with mode', () => {
      const error = new MissingWordMapError('lemma');

      expect(error).toBeInstanceOf(TokenizationError);
      expect(error.code).toBe(ErrorCode.TOKENIZATION_MISSING_WORD_MAP);
      expect(error.message).toContain('lemma');
      expect(error.message).toContain('Word map is required');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all tokenization error types', () => {
      const missingMorphology = new MissingMorphologyError(1);
      const invalidMode = new InvalidModeError('test');
      const missingWordMap = new MissingWordMapError('lemma');

      expect(missingMorphology instanceof TokenizationError).toBe(true);
      expect(invalidMode instanceof TokenizationError).toBe(true);
      expect(missingWordMap instanceof TokenizationError).toBe(true);
    });
  });
});
