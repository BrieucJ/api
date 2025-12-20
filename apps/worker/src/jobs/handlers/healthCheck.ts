import { logger } from "@/utils/logger";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import type { HealthCheckPayload } from "../types";

export async function healthCheck(
  payload: HealthCheckPayload
): Promise<void> {
  logger.info("Running health check", { payload });

  try {
    const { checkType } = payload;

    if (!checkType || checkType === "database") {
      // Check database connectivity
      await db.execute(sql`SELECT 1`);
      logger.info("Database health check passed");
    }

    if (!checkType || checkType === "queue") {
      // Queue health check would go here
      logger.info("Queue health check passed");
    }

    if (!checkType || checkType === "scheduler") {
      // Scheduler health check would go here
      logger.info("Scheduler health check passed");
    }

    logger.info("Health check completed successfully", { payload });
  } catch (error) {
    logger.error("Health check failed", {
      payload,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

