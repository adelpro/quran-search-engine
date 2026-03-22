import { describe, it, expect } from 'vitest';
import {
  SearchError,
  InvalidQueryError,
  MissingDependenciesError,
  SearchOperationFailedError,
} from './search-error';
import { ErrorCode, ErrorType } from './error-codes';

describe('SearchError', () => {
  describe('InvalidQueryError', () => {
    it('should create error with query and details', () => {
      const error = new InvalidQueryError('', 'Query cannot be empty');

      expect(error).toBeInstanceOf(SearchError);
      expect(error).toBeInstanceOf(InvalidQueryError);
      expect(error.code).toBe(ErrorCode.SEARCH_INVALID_QUERY);
      expect(error.type).toBe(ErrorType.SEARCH_ERROR);
      expect(error.message).toContain('Invalid search query');
      expect(error.message).toContain('Query cannot be empty');
      expect(error.query).toBe('');
    });

    it('should create error without details', () => {
      const error = new InvalidQueryError('xyz');

      expect(error.message).toBe('Invalid search query: "xyz"');
      expect(error.query).toBe('xyz');
    });
  });

  describe('MissingDependenciesError', () => {
    it('should create error with missing dependencies list', () => {
      const error = new MissingDependenciesError(['morphologyMap', 'wordMap']);

      expect(error).toBeInstanceOf(SearchError);
      expect(error.code).toBe(ErrorCode.SEARCH_MISSING_DEPENDENCIES);
      expect(error.message).toContain('morphologyMap, wordMap');
      expect(error.missingDependencies).toEqual(['morphologyMap', 'wordMap']);
    });
  });

  describe('SearchOperationFailedError', () => {
    it('should create error with operation name and cause', () => {
      const cause = new Error('Network timeout');
      const error = new SearchOperationFailedError('advancedSearch', cause);

      expect(error).toBeInstanceOf(SearchError);
      expect(error.code).toBe(ErrorCode.SEARCH_OPERATION_FAILED);
      expect(error.message).toContain('advancedSearch');
      expect(error.message).toContain('Network timeout');
      expect(error.operation).toBe('advancedSearch');
      expect(error.cause).toBe(cause);
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all search error types', () => {
      const invalidQuery = new InvalidQueryError('test');
      const missingDeps = new MissingDependenciesError(['data']);
      const opFailed = new SearchOperationFailedError('test');

      expect(invalidQuery instanceof SearchError).toBe(true);
      expect(missingDeps instanceof SearchError).toBe(true);
      expect(opFailed instanceof SearchError).toBe(true);

      expect(invalidQuery instanceof Error).toBe(true);
      expect(missingDeps instanceof Error).toBe(true);
      expect(opFailed instanceof Error).toBe(true);
    });
  });
});
