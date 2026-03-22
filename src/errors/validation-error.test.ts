import { describe, it, expect } from 'vitest';
import { ValidationError, InvalidPaginationError, InvalidOptionsError } from './validation-error';
import { ErrorCode, ErrorType } from './error-codes';

describe('ValidationError', () => {
  describe('InvalidPaginationError', () => {
    it('should create error with pagination parameters', () => {
      const error = new InvalidPaginationError(-1, 10);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(InvalidPaginationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_PAGINATION);
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toContain('page=-1');
      expect(error.message).toContain('limit=10');
      expect(error.page).toBe(-1);
      expect(error.limit).toBe(10);
    });
  });

  describe('InvalidOptionsError', () => {
    it('should create error with reason', () => {
      const error = new InvalidOptionsError('lemma and root cannot both be false');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_INVALID_OPTIONS);
      expect(error.message).toContain('lemma and root cannot both be false');
      expect(error.reason).toBe('lemma and root cannot both be false');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all validation error types', () => {
      const invalidPagination = new InvalidPaginationError(0, 0);
      const invalidOptions = new InvalidOptionsError('test');

      expect(invalidPagination instanceof ValidationError).toBe(true);
      expect(invalidOptions instanceof ValidationError).toBe(true);

      expect(invalidPagination instanceof Error).toBe(true);
      expect(invalidOptions instanceof Error).toBe(true);
    });
  });
});
