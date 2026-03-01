export interface Task<TParams = unknown, TResult = unknown> {
    name: string;
    params: TParams;
}
export interface TaskResult<TResult = unknown> {
    name: string;
    result?: TResult;
    error?: string;
    durationMs: number;
}
