import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import env from "@/env";
import { dbLogger } from "@shared/utils";

// Configure postgres client for Lambda environment
// Lambda has specific networking constraints that may affect DNS resolution
const client = postgres(env.DATABASE_URL!, {
  max: 1, // Lambda-friendly: single connection
  idle_timeout: 60000, // 60 seconds
  connect_timeout: 10, // 10 second connection timeout
  // Lambda-specific optimizations
  prepare: false, // Disable prepared statements for better compatibility
  onnotice: () => {}, // Suppress notices
  transform: {
    undefined: null, // Transform undefined to null for JSONB compatibility
  },
});

export const db = drizzle(client, {
  logger: {
    logQuery: (query, params) => dbLogger.debug(query, params),
  },
});
