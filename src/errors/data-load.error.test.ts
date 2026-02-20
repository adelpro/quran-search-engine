import { describe, it, expect } from 'vitest';
import {
  DataLoadError,
  DataFileNotFoundError,
  DataParseError,
  DataSchemaInvalidError,
} from './data-load.error';
import { ErrorCode, ErrorType } from './error-codes';

describe('DataLoadError', () => {
  describe('DataFileNotFoundError', () => {
    it('should create error with file path', () => {
      const error = new DataFileNotFoundError('../data/test.json');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DataLoadError);
      expect(error).toBeInstanceOf(DataFileNotFoundError);
      expect(error.code).toBe(ErrorCode.DATA_FILE_NOT_FOUND);
      expect(error.type).toBe(ErrorType.DATA_ERROR);
      expect(error.message).toBe('Data file not found: ../data/test.json');
      expect(error.filePath).toBe('../data/test.json');
    });
  });

  describe('DataParseError', () => {
    it('should create error with file path', () => {
      const error = new DataParseError('../data/test.json');

      expect(error).toBeInstanceOf(DataLoadError);
      expect(error.code).toBe(ErrorCode.DATA_PARSE_ERROR);
      expect(error.type).toBe(ErrorType.DATA_ERROR);
      expect(error.message).toBe('Failed to parse data file: ../data/test.json');
      expect(error.filePath).toBe('../data/test.json');
    });
  });

  describe('DataSchemaInvalidError', () => {
    it('should create error with details', () => {
      const error = new DataSchemaInvalidError('../data/test.json', 'Missing required field: gid');

      expect(error).toBeInstanceOf(DataLoadError);
      expect(error.code).toBe(ErrorCode.DATA_SCHEMA_INVALID);
      expect(error.type).toBe(ErrorType.DATA_ERROR);
      expect(error.message).toBe(
        'Invalid data schema in ../data/test.json: Missing required field: gid',
      );
      expect(error.filePath).toBe('../data/test.json');
    });
  });

  describe('instanceof checks', () => {
    it('should work correctly for all data error types', () => {
      const fileNotFound = new DataFileNotFoundError('../data/test.json');
      const parseError = new DataParseError('../data/test.json');
      const schemaError = new DataSchemaInvalidError('../data/test.json', 'Invalid');

      expect(fileNotFound instanceof DataLoadError).toBe(true);
      expect(parseError instanceof DataLoadError).toBe(true);
      expect(schemaError instanceof DataLoadError).toBe(true);

      expect(fileNotFound instanceof DataFileNotFoundError).toBe(true);
      expect(parseError instanceof DataParseError).toBe(true);
      expect(schemaError instanceof DataSchemaInvalidError).toBe(true);
    });
  });
});
