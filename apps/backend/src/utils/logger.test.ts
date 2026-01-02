import { logger, dbLogger, workerLogger } from "./logger";

console.log("\n=== Testing Logger Refactor ===\n");

// Test 1: Basic logging (should be synchronous now)
console.log("Test 1: Basic logging");
logger.info("This is an info message");
logger.warn("This is a warning");
logger.error("This is an error");
logger.debug("This is a debug message");

// Test 2: Logging with metadata
console.log("\nTest 2: Logging with metadata");
logger.info("User action", {
  userId: 123,
  action: "login",
  timestamp: Date.now(),
});

// Test 3: Different namespaces
console.log("\nTest 3: Different namespaces");
dbLogger.info("Database query executed");
workerLogger.info("Worker job started");

// Test 4: Custom namespace
console.log("\nTest 4: Custom namespace");
const customLogger = logger.withNamespace("CUSTOM");
customLogger.info("Custom namespace message");

// Test 5: Error with stack trace
console.log("\nTest 5: Error with stack trace");
try {
  throw new Error("Test error");
} catch (err) {
  logger.error("Caught an error", { error: err });
}

console.log("\n=== All tests completed ===");
console.log("Logger is now synchronous - no promises returned!");
console.log(
  "DB persistence happens in background via logPersistence service.\n"
);
