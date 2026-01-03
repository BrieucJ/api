import { runInTransaction } from "./db-setup";

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or times out
 * Useful for waiting for database operations to complete in CI
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    check?: (result: T) => boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 10, delayMs = 100, check } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (check && !check(result)) {
        if (attempt === maxAttempts) {
          throw new Error(
            `Retry failed after ${maxAttempts} attempts: check condition not met`
          );
        }
        await wait(delayMs);
        continue;
      }
      return result;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await wait(delayMs);
    }
  }

  throw new Error(`Retry failed after ${maxAttempts} attempts`);
}

/**
 * Run a test with automatic transaction rollback
 * This ensures perfect isolation - each test gets a clean database state
 */
export function withTransaction<T>(testFn: () => Promise<T>): () => Promise<T> {
  return () => runInTransaction(testFn);
}
