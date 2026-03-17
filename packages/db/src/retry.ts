import { DeadlockError, SerializationError } from "./errors";

/**
 * Retry an operation on serialization or deadlock errors (e.g. with serializable isolation).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 100,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const isRetryable =
        err instanceof SerializationError || err instanceof DeadlockError;
      if (!isRetryable || attempt === maxAttempts) throw err;
      const jitter = Math.random() * baseDelayMs;
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1) + jitter),
      );
    }
  }
  throw new Error("Unreachable");
}
