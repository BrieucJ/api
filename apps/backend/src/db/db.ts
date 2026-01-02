import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import env from "@/env";
import { dbLogger } from "@/utils/logger";

const client = postgres(env.DATABASE_URL!, {
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
