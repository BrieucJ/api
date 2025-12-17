import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import env from "@/env";
import { dbLogger } from "@/utils/logger";

const client = postgres(env.DATABASE_URL!, {
  max: 1, // Lambda-friendly
  idle_timeout: 60000,
});

export const db = drizzle(client, {
  logger: {
    logQuery: (query, params) => dbLogger.info(query, params),
  },
});
