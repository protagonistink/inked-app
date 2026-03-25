/**
 * Lightweight retry queue for failed Asana sync operations.
 *
 * When an Asana API call fails (network error, timeout), the operation
 * is queued for retry. Retries are attempted when `flush()` is called,
 * which should happen on the next successful external sync cycle.
 *
 * Operations are stored in memory only — they're lost on app restart,
 * which is acceptable since the local task state is the source of truth.
 */

interface PendingSync {
  taskId: string;
  completed: boolean;
  attempts: number;
  addedAt: number;
}

const MAX_ATTEMPTS = 3;
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

let queue: PendingSync[] = [];

/**
 * Enqueue a failed Asana completion sync for retry.
 */
export function enqueueAsanaSync(taskId: string, completed: boolean) {
  // Deduplicate — if already queued, update the completed state
  const existing = queue.find((p) => p.taskId === taskId);
  if (existing) {
    existing.completed = completed;
    existing.attempts = 0;
    existing.addedAt = Date.now();
    return;
  }
  queue.push({ taskId, completed, attempts: 0, addedAt: Date.now() });
}

/**
 * Attempt to flush all pending syncs. Call this during external sync
 * refresh cycles or after a successful Asana API call.
 *
 * Returns the number of successfully flushed operations.
 */
export async function flushAsanaQueue(): Promise<number> {
  if (queue.length === 0) return 0;

  const now = Date.now();
  // Drop expired entries
  queue = queue.filter((p) => now - p.addedAt < MAX_AGE_MS);

  let flushed = 0;
  const remaining: PendingSync[] = [];

  for (const pending of queue) {
    try {
      await window.api.asana.completeTask(pending.taskId, pending.completed);
      flushed++;
    } catch {
      pending.attempts++;
      if (pending.attempts < MAX_ATTEMPTS) {
        remaining.push(pending);
      }
      // else: silently drop after max attempts
    }
  }

  queue = remaining;
  return flushed;
}

/** Number of pending operations (for testing/debugging). */
export function pendingCount(): number {
  return queue.length;
}

/** Clear all pending operations (for testing). */
export function clearQueue() {
  queue = [];
}
