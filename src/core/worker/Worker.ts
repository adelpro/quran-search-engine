import { Task, TaskResult } from "./interfaces";

const registry: Record<
  string,
  (params: unknown) => unknown | Promise<unknown>
> = {
  // Example task implementation, These shall be replaced by actual search strategies in SearchWorker, for now it is a test f or the worker
  Sum: (params: unknown) => {
    const { num1, num2 } = params as { num1: number; num2: number };
    return num1 + num2;
  },
};

self.onmessage = async (e: MessageEvent<Task>) => {
  const { name, params } = e.data;
  const t0 = performance.now();

  const fn = registry[name];

  if (!fn) {
    const result: TaskResult = {
      name,
      error:
        `No function registered for task "${name}". ` +
        `Available: ${Object.keys(registry).join(", ")}`,
      durationMs: 0,
    };
    self.postMessage(result);
    return;
  }

  try {
    const result: TaskResult = {
      name,
      result: await fn(params),
      durationMs: performance.now() - t0,
    };
    self.postMessage(result);
  } catch (err) {
    const result: TaskResult = {
      name,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - t0,
    };
    self.postMessage(result);
  }
};
