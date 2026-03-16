export {
  createSearchWorker,
  supportsWorkers,
  type CreateSearchWorkerOptions,
  type FallbackDependencies,
} from './searchWorkerClient';
export type {
  SearchWorkerClient,
  WorkerRequest,
  WorkerResponse,
  InitDataRequest,
  RunSearchRequest,
  DisposeRequest,
  InitDataResponse,
  SearchResultResponse,
  ErrorResponse,
} from './types';
