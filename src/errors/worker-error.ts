import { BaseError } from './base-error';
import { ErrorCode, ErrorType } from './error-codes';

export class WorkerError extends BaseError {
  constructor(code: ErrorCode, message: string) {
    super(code, ErrorType.WORKER_ERROR, message);
    Object.setPrototypeOf(this, WorkerError.prototype);
  }
}

export class WorkerNotSupportedError extends WorkerError {
  constructor() {
    super(ErrorCode.WORKER_NOT_SUPPORTED, 'Web Workers are not supported in this environment.');
    Object.setPrototypeOf(this, WorkerNotSupportedError.prototype);
  }
}

export class WorkerInitializationError extends WorkerError {
  constructor(reason?: string) {
    super(
      ErrorCode.WORKER_INITIALIZATION_FAILED,
      reason ? `Failed to initialize worker: ${reason}` : 'Failed to initialize worker',
    );
    Object.setPrototypeOf(this, WorkerInitializationError.prototype);
  }
}

export class WorkerTerminatedError extends WorkerError {
  constructor() {
    super(ErrorCode.WORKER_TERMINATED, 'Worker was terminated unexpectedly.');
    Object.setPrototypeOf(this, WorkerTerminatedError.prototype);
  }
}

export class WorkerNotInitializedError extends WorkerError {
  constructor() {
    super(ErrorCode.WORKER_NOT_INITIALIZED, 'Worker client not initialized. Call initData first.');
    Object.setPrototypeOf(this, WorkerNotInitializedError.prototype);
  }
}

export class WorkerFactoryError extends WorkerError {
  constructor(reason: string) {
    super(ErrorCode.WORKER_FACTORY_ERROR, `Cannot create search worker: ${reason}`);
    Object.setPrototypeOf(this, WorkerFactoryError.prototype);
  }
}
