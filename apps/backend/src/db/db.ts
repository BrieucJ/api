/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbLogger } from "@/utils/logger";

// Get the directory where this file is located, then go up to the app directory
// For Bun: use import.meta.dir
// For Node.js/drizzle-kit: use process.cwd() since we're in the app root
let appDir: string;
try {
  // Try Bun's import.meta.dir first
  if (import.meta?.dir) {
    appDir = path.resolve(import.meta.dir, "..", "..");
  } else if (import.meta?.url) {
    // Node.js ESM fallback
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    appDir = path.resolve(currentDir, "..", "..");
  } else {
    // Fallback to process.cwd() for tools like drizzle-kit
    appDir = process.cwd();
  }
} catch {
  // If all else fails, use process.cwd()
  appDir = process.cwd();
}

// Load environment-specific file based on NODE_ENV
let envPath: string;
if (process.env.NODE_ENV === "test") {
  envPath = path.resolve(appDir, ".env.test");
} else if (process.env.NODE_ENV === "production") {
  envPath = path.resolve(appDir, ".env.production");
} else if (process.env.NODE_ENV === "staging") {
  envPath = path.resolve(appDir, ".env.staging");
} else {
  // Default to .env.dev for development
  const envDevPath = path.resolve(appDir, ".env.dev");
  const envPathLegacy = path.resolve(appDir, ".env");
  envPath = envDevPath;
  // Also try loading .env as fallback
  expand(
    config({
      path: envPathLegacy,
      quiet: true,
    })
  );
}

expand(
  config({
    path: envPath,
    quiet: true,
  })
);

const client = postgres(process.env.DATABASE_URL!, {
  max: 3, // Allow 3 connections for parallel queries (Lambda can handle this)
  idle_timeout: 60000, // 60 seconds
  connect_timeout: 10, // 10 second connection timeout
  transform: {
    undefined: null, // Transform undefined to null for JSONB compatibility
  },
});

export const db = drizzle(client, {
  logger: {
    logQuery: (query, params) => dbLogger.debug(query, params),
  },
});
