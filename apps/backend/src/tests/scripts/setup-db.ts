#!/usr/bin/env bun

import { setupTestDatabase } from "../helpers/db-setup";

async function main() {
  console.log("🔧 Setting up test database...");
  try {
    await setupTestDatabase();
    console.log("✅ Test database setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to setup test database:", error);
    process.exit(1);
  }
}

main();

