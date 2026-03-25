// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueAsanaSync, flushAsanaQueue, pendingCount, clearQueue } from './asanaRetryQueue';

beforeEach(() => {
  clearQueue();
  (window as any).api = {
    asana: {
      completeTask: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('asanaRetryQueue', () => {
  it('enqueues and flushes a pending sync', async () => {
    enqueueAsanaSync('task-1', true);
    expect(pendingCount()).toBe(1);

    const flushed = await flushAsanaQueue();
    expect(flushed).toBe(1);
    expect(pendingCount()).toBe(0);
    expect(window.api.asana.completeTask).toHaveBeenCalledWith('task-1', true);
  });

  it('returns 0 when queue is empty', async () => {
    const flushed = await flushAsanaQueue();
    expect(flushed).toBe(0);
  });

  it('retries on failure up to 3 times', async () => {
    (window.api.asana.completeTask as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));

    enqueueAsanaSync('task-1', true);

    await flushAsanaQueue(); // attempt 1 — fails, kept
    expect(pendingCount()).toBe(1);

    await flushAsanaQueue(); // attempt 2 — fails, kept
    expect(pendingCount()).toBe(1);

    await flushAsanaQueue(); // attempt 3 — fails, dropped
    expect(pendingCount()).toBe(0);
  });

  it('deduplicates by taskId, updating completed state', () => {
    enqueueAsanaSync('task-1', true);
    enqueueAsanaSync('task-1', false);
    expect(pendingCount()).toBe(1);
  });

  it('flushes successfully after a failed attempt', async () => {
    (window.api.asana.completeTask as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    enqueueAsanaSync('task-1', true);

    await flushAsanaQueue(); // fails
    expect(pendingCount()).toBe(1);

    await flushAsanaQueue(); // succeeds
    expect(pendingCount()).toBe(0);
  });
});
