import { afterEach, describe, it, expect, vi } from 'vitest';
import { createSearchWorker } from './index';

describe('createSearchWorker', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it('should create a fallback client when Worker is not available', () => {
    // @ts-expect-error - removing Worker for testing
    delete globalThis.Worker;

    const client = createSearchWorker();
    expect(client).toBeDefined();
    expect(typeof client.init).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.terminate).toBe('function');
  });

  it('should create a fallback client when workerFactory throws', () => {
    const client = createSearchWorker(() => {
      throw new Error('Worker creation failed');
    });
    expect(client).toBeDefined();
    expect(typeof client.init).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.terminate).toBe('function');
  });

  it('fallback client should throw if search called before init', async () => {
    const client = createSearchWorker(() => {
      throw new Error('No workers');
    });

    await expect(client.search('test')).rejects.toThrow('Client not initialized');
  });

  it('terminate on fallback client should be a no-op', () => {
    const client = createSearchWorker(() => {
      throw new Error('No workers');
    });
    expect(() => client.terminate()).not.toThrow();
  });

  it('should use workerFactory when provided and it succeeds', () => {
    const mockPostMessage = vi.fn();
    const mockTerminate = vi.fn();
    const mockWorker = {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
    } as unknown as Worker;

    const factory = vi.fn(() => mockWorker);
    const client = createSearchWorker(factory);

    expect(factory).toHaveBeenCalledOnce();
    expect(client).toBeDefined();

    client.terminate();
    expect(mockTerminate).toHaveBeenCalledOnce();
  });
});
