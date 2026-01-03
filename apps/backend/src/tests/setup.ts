import { beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, resetTestDatabase } from "./helpers/db-setup";

// Set test environment before any imports
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

// Global test setup - runs once before all tests
beforeAll(async () => {
  console.log("🔧 Setting up test database...");

  try {
    await setupTestDatabase();
    console.log("✅ Test database ready");
  } catch (error) {
    console.error("❌ Failed to setup test database:", error);
    throw error;
  }
});

// Global test cleanup - runs once after all tests
afterAll(async () => {
  console.log("🧹 Cleaning up test database...");

  // Reset database (keeps structure, clears data)
  // This ensures clean state for next test run
  await resetTestDatabase();

  console.log("✅ Test database cleanup complete");
});
