#!/usr/bin/env bun

import { resetTestDatabase } from "../helpers/db-setup";

async function main() {
  console.log("🔄 Resetting test database...");
  try {
    await resetTestDatabase();
    console.log("✅ Test database reset complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to reset test database:", error);
    process.exit(1);
  }
}

main();

