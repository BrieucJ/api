#!/usr/bin/env bun

import { dropTestDatabase } from "../helpers/db-setup";

async function main() {
  console.log("🗑️  Dropping test database...");
  try {
    await dropTestDatabase();
    console.log("✅ Test database dropped!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to drop test database:", error);
    process.exit(1);
  }
}

main();

