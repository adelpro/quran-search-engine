import { Task, TaskResult } from './interfaces';

export class WorkerPool {
  private workers: Worker[] = [];
  private TaskQueue: Task[] = [];
  private idleWorkers: Worker[] = [];
  private callbackfn?: (result: TaskResult) => void;

  constructor(workerScript: string, poolSize: number, callbackfn?: (result: TaskResult) => void) {
    if (callbackfn) this.callbackfn = callbackfn;
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript, { type: 'module' });
      worker.onmessage = (e: MessageEvent<TaskResult>) => {
        this.handleResult(worker, e.data);
      };
      worker.onerror = (err) => {
        console.error(`Worker error: ${err.message}`);
        this.idleWorkers.push(worker);
      };
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }
  submitTask(task: Task) {
    this.TaskQueue.push(task);
    this.schedule();
  }
  schedule() {
    if (this.TaskQueue.length === 0 || this.idleWorkers.length === 0) return;
    const task = this.TaskQueue.shift()!;
    const worker = this.idleWorkers.pop()!;

    worker.postMessage(task);
  }

  private handleResult(worker: Worker, result: TaskResult): void {
    this.callbackfn?.(result);
    this.idleWorkers.push(worker);
    this.schedule();
  }

  destroy(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.idleWorkers = [];
    this.TaskQueue = [];
  }
  get idleCount(): number {
    return this.idleWorkers.length;
  }
  get queuedCount(): number {
    return this.TaskQueue.length;
  }
}
