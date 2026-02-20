import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  NonArabicInputError,
  InvalidPaginationError,
  InvalidOptionsError,
  InvalidVerseStructureError,
} from './validation.error';
import { ErrorCode, ErrorType } from './error-codes';

describe('ValidationError', () => {
  describe('NonArabicInputError', () => {
    it('should create error with input text', () => {
      const error = new NonArabicInputError('hello world');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_NON_ARABIC_INPUT);
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toContain('Arabic characters');
      expect(error.message).toContain('hello world');
    });

    it('should truncate long input text', () => {
      const longText = 'a'.repeat(100);
      const error = new NonArabicInputError(longText);

      expect(error.message).toContain('...');
      expect(error.message.length).toBeLessThan(longText.length + 50);
    });
  });

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
      const nonArabic = new NonArabicInputError('test');
      const invalidPagination = new InvalidPaginationError(0, 0);
      const invalidOptions = new InvalidOptionsError('test');
      const invalidVerse = new InvalidVerseStructureError('test');

      expect(nonArabic instanceof ValidationError).toBe(true);
      expect(invalidPagination instanceof ValidationError).toBe(true);
      expect(invalidOptions instanceof ValidationError).toBe(true);
      expect(invalidVerse instanceof ValidationError).toBe(true);
    });
  });
});
