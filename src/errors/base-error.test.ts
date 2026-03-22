import { describe, it, expect } from 'vitest';
import { BaseError } from './base-error';
import { ErrorCode, ErrorType } from './error-codes';

describe('BaseError', () => {
  it('should create an error with code, type, and message', () => {
    const error = new BaseError(
      ErrorCode.DATA_FILE_NOT_FOUND,
      ErrorType.DATA_ERROR,
      'Test error message',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
    expect(error.code).toBe(ErrorCode.DATA_FILE_NOT_FOUND);
    expect(error.type).toBe(ErrorType.DATA_ERROR);
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('BaseError');
  });

  it('should have a stack trace', () => {
    const error = new BaseError(ErrorCode.DATA_FILE_NOT_FOUND, ErrorType.DATA_ERROR, 'Test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('BaseError');
  });

  it('should work with instanceof checks', () => {
    const error = new BaseError(ErrorCode.DATA_FILE_NOT_FOUND, ErrorType.DATA_ERROR, 'Test');
    expect(error instanceof BaseError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
