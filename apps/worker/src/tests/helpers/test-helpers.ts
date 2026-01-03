import { runInTransaction } from "./db-setup";

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a test with automatic transaction rollback
 * This ensures perfect isolation - each test gets a clean database state
 */
export function withTransaction<T>(testFn: () => Promise<T>): () => Promise<T> {
  return () => runInTransaction(testFn);
}
