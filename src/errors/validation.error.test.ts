import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  InvalidPaginationError,
  InvalidOptionsError,
  InvalidVerseStructureError,
} from './validation.error';
import { ErrorCode, ErrorType } from './error-codes';

describe('ValidationError', () => {
  describe('InvalidPaginationError', () => {
    it('should create error with pagination parameters', () => {
      const error = new InvalidPaginationError(-1, 10);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_PAGINATION);
      expect(error.message).toContain('page=-1');
      expect(error.message).toContain('limit=10');
    });
  });

  describe('InvalidOptionsError', () => {
    it('should create error with reason', () => {
      const error = new InvalidOptionsError('lemma and root cannot both be false');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_OPTIONS);
      expect(error.message).toContain('lemma and root cannot both be false');
    });
  });

  describe('InvalidVerseStructureError', () => {
    it('should create error with details', () => {
      const error = new InvalidVerseStructureError('Missing gid field');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_VERSE_STRUCTURE);
      expect(error.message).toContain('Missing gid field');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all validation error types', () => {
      const invalidPagination = new InvalidPaginationError(0, 0);
      const invalidOptions = new InvalidOptionsError('test');
      const invalidVerse = new InvalidVerseStructureError('test');

      expect(invalidPagination instanceof ValidationError).toBe(true);
      expect(invalidOptions instanceof ValidationError).toBe(true);
      expect(invalidVerse instanceof ValidationError).toBe(true);
    });
  });
});
