import { describe, it, expect, vi } from 'vitest';
import { withTimeout, IpcTimeoutError } from './ipc';

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 'test', 1000);
    expect(result).toBe('ok');
  });

  it('rejects with IpcTimeoutError when promise exceeds timeout', async () => {
    vi.useFakeTimers();

    const slow = new Promise(() => {}); // never resolves
    const promise = withTimeout(slow, 'slow.op', 100);

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow(IpcTimeoutError);
    await expect(promise).rejects.toThrow('slow.op');
    await expect(promise).rejects.toThrow('100ms');

    vi.useRealTimers();
  });

  it('uses 10s default timeout', async () => {
    vi.useFakeTimers();

    const slow = new Promise(() => {});
    const promise = withTimeout(slow, 'default.timeout');

    vi.advanceTimersByTime(9999);
    // Not yet timed out
    const settled = await Promise.race([
      promise.then(() => 'resolved').catch(() => 'rejected'),
      Promise.resolve('pending'),
    ]);
    expect(settled).toBe('pending');

    vi.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow(IpcTimeoutError);

    vi.useRealTimers();
  });

  it('cleans up timeout when promise resolves first', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve('fast'), 'fast.op', 5000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
