import { describe, it, expect } from 'vitest';
import {
  SearchError,
  InvalidQueryError,
  MissingDependenciesError,
  SearchOperationFailedError,
} from './search.error';
import { ErrorCode, ErrorType } from './error-codes';

describe('SearchError', () => {
  describe('InvalidQueryError', () => {
    it('should create error with query', () => {
      const error = new InvalidQueryError('');

      expect(error).toBeInstanceOf(SearchError);
      expect(error.code).toBe(ErrorCode.SEARCH_INVALID_QUERY);
      expect(error.type).toBe(ErrorType.SEARCH_ERROR);
      expect(error.message).toContain('Invalid search query');
    });

    it('should include reason when provided', () => {
      const error = new InvalidQueryError('test', 'Must contain Arabic characters');

      expect(error.message).toContain('test');
      expect(error.message).toContain('Must contain Arabic characters');
    });
  });

  describe('MissingDependenciesError', () => {
    it('should create error with dependency list', () => {
      const error = new MissingDependenciesError(['morphologyMap', 'wordMap']);

      expect(error).toBeInstanceOf(SearchError);
      expect(error.code).toBe(ErrorCode.SEARCH_MISSING_DEPENDENCIES);
      expect(error.message).toContain('morphologyMap');
      expect(error.message).toContain('wordMap');
    });
  });

  describe('SearchOperationFailedError', () => {
    it('should create error with operation name', () => {
      const error = new SearchOperationFailedError('advancedSearch');

      expect(error).toBeInstanceOf(SearchError);
      expect(error.code).toBe(ErrorCode.SEARCH_OPERATION_FAILED);
      expect(error.message).toContain('advancedSearch');
    });

    it('should include cause message when provided', () => {
      const cause = new Error('Timeout exceeded');
      const error = new SearchOperationFailedError('advancedSearch', cause);

      expect(error.message).toContain('Timeout exceeded');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all search error types', () => {
      const invalidQuery = new InvalidQueryError('');
      const missingDeps = new MissingDependenciesError(['morphology']);
      const opFailed = new SearchOperationFailedError('search');

      expect(invalidQuery instanceof SearchError).toBe(true);
      expect(missingDeps instanceof SearchError).toBe(true);
      expect(opFailed instanceof SearchError).toBe(true);
    });
  });
});
