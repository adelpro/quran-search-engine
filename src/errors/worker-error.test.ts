import { describe, it, expect } from 'vitest';
import {
  WorkerError,
  WorkerNotSupportedError,
  WorkerInitializationError,
  WorkerTerminatedError,
  WorkerNotInitializedError,
  WorkerFactoryError,
} from './worker-error';
import { ErrorCode } from './error-codes';

describe('WorkerError', () => {
  it('should have correct code and type', () => {
    const error = new WorkerError(ErrorCode.WORKER_NOT_SUPPORTED, 'Test message');
    expect(error.code).toBe(ErrorCode.WORKER_NOT_SUPPORTED);
    expect(error.type).toBe('WorkerError');
    expect(error.message).toBe('Test message');
  });

  it('should be instance of Error', () => {
    const error = new WorkerError(ErrorCode.WORKER_NOT_SUPPORTED, 'Test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('WorkerNotSupportedError', () => {
  it('should have correct code and message', () => {
    const error = new WorkerNotSupportedError();
    expect(error.code).toBe('WORKER_NOT_SUPPORTED');
    expect(error.type).toBe('WorkerError');
    expect(error.message).toBe('Web Workers are not supported in this environment.');
  });

  it('should be instance of WorkerError', () => {
    const error = new WorkerNotSupportedError();
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('WorkerInitializationError', () => {
  it('should have correct code with reason', () => {
    const error = new WorkerInitializationError('CSP blocked');
    expect(error.code).toBe('WORKER_INITIALIZATION_FAILED');
    expect(error.message).toBe('Failed to initialize worker: CSP blocked');
  });

  it('should have default message when no reason provided', () => {
    const error = new WorkerInitializationError();
    expect(error.message).toBe('Failed to initialize worker');
  });

  it('should be instance of WorkerError', () => {
    const error = new WorkerInitializationError();
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('WorkerTerminatedError', () => {
  it('should have correct code and message', () => {
    const error = new WorkerTerminatedError();
    expect(error.code).toBe('WORKER_TERMINATED');
    expect(error.message).toBe('Worker was terminated unexpectedly.');
  });

  it('should be instance of WorkerError', () => {
    const error = new WorkerTerminatedError();
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('WorkerNotInitializedError', () => {
  it('should have correct code and message', () => {
    const error = new WorkerNotInitializedError();
    expect(error.code).toBe('WORKER_NOT_INITIALIZED');
    expect(error.message).toBe('Worker client not initialized. Call initData first.');
  });

  it('should be instance of WorkerError', () => {
    const error = new WorkerNotInitializedError();
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('WorkerFactoryError', () => {
  it('should have correct code and message', () => {
    const error = new WorkerFactoryError('No fallback provided');
    expect(error.code).toBe('WORKER_FACTORY_ERROR');
    expect(error.message).toBe('Cannot create search worker: No fallback provided');
  });

  it('should be instance of WorkerError', () => {
    const error = new WorkerFactoryError('test');
    expect(error).toBeInstanceOf(WorkerError);
  });
});
