import { describe, it, expect } from 'vitest';
import { TokenizationError, MissingMorphologyError, InvalidModeError } from './tokenization-error';
import { ErrorCode, ErrorType } from './error-codes';

describe('TokenizationError', () => {
  describe('MissingMorphologyError', () => {
    it('should create error with verse GID', () => {
      const error = new MissingMorphologyError(1234);

      expect(error).toBeInstanceOf(TokenizationError);
      expect(error).toBeInstanceOf(MissingMorphologyError);
      expect(error.code).toBe(ErrorCode.TOKENIZATION_MISSING_MORPHOLOGY);
      expect(error.type).toBe(ErrorType.TOKENIZATION_ERROR);
      expect(error.message).toContain('1234');
      expect(error.gid).toBe(1234);
    });
  });

  describe('InvalidModeError', () => {
    it('should create error with mode value', () => {
      const error = new InvalidModeError('invalid');

      expect(error).toBeInstanceOf(TokenizationError);
      expect(error).toBeInstanceOf(InvalidModeError);
      expect(error.code).toBe(ErrorCode.TOKENIZATION_INVALID_MODE);
      expect(error.type).toBe(ErrorType.TOKENIZATION_ERROR);
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('text, lemma, root');
      expect(error.mode).toBe('invalid');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all tokenization error types', () => {
      const missingMorph = new MissingMorphologyError(123);
      const invalidMode = new InvalidModeError('test');

      expect(missingMorph instanceof TokenizationError).toBe(true);
      expect(invalidMode instanceof TokenizationError).toBe(true);

      expect(missingMorph instanceof Error).toBe(true);
      expect(invalidMode instanceof Error).toBe(true);
    });
  });
});
