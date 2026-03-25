/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the given milliseconds, rejects with an IpcTimeoutError.
 *
 * Use this around window.api.* calls that hit external services (Asana,
 * GCal, Stripe, AI) where network latency or a crashed main process
 * could cause the UI to hang indefinitely.
 */
export class IpcTimeoutError extends Error {
  constructor(operation: string, ms: number) {
    super(`IPC call "${operation}" timed out after ${ms}ms`);
    this.name = 'IpcTimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  operation: string,
  ms = 10_000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new IpcTimeoutError(operation, ms)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
