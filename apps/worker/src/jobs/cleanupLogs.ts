import { z } from "zod";
import { logger } from "@/utils/logger";
import { db } from "@/utils/db";
import { logs } from "@shared/db";
import { sql } from "drizzle-orm";
import { JobType } from "./types";
import type { JobDefinition } from "./types";

// Payload schema
export const payloadSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
  batchSize: z.number().int().positive().default(1000),
});

export type CleanupLogsPayload = z.infer<typeof payloadSchema>;

// Handler
export const handler = async (payload: CleanupLogsPayload): Promise<void> => {
  logger.info("Starting log cleanup", { payload });

  try {
    const { olderThanDays, batchSize } = payload;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Use raw SQL for batch deletion with limit
      // Note: PostgreSQL DELETE with LIMIT requires using a subquery
      const cutoffDateStr = cutoffDate.toISOString();
      const result = await db.execute(sql`
        DELETE FROM ${logs}
        WHERE ${logs.id} IN (
          SELECT ${logs.id}
          FROM ${logs}
          WHERE ${logs.created_at} < ${cutoffDateStr}::timestamp
            AND ${logs.deleted_at} IS NULL
          LIMIT ${batchSize}
        )
      `);

      // postgres-js returns count in result array length or we can check affected rows
      const deleted = Array.isArray(result)
        ? result.length
        : (result as any).rowCount || 0;
      deletedCount += deleted;
      hasMore = deleted === batchSize;

      logger.debug(`Deleted ${deleted} logs in this batch`, {
        totalDeleted: deletedCount,
        hasMore,
      });

      // Small delay to avoid overwhelming the database
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info("Log cleanup completed", {
      payload,
      totalDeleted: deletedCount,
    });
  } catch (error) {
    logger.error("Failed to cleanup logs", {
      payload,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Job definition
export const definition: JobDefinition = {
  type: JobType.CLEANUP_LOGS,
  name: "Cleanup Logs",
  description: "Removes old log entries based on retention policy",
  category: "maintenance",
  payloadSchema,
  defaultOptions: {
    maxAttempts: 3,
  },
  settings: {
    defaultOlderThanDays: 30,
    defaultBatchSize: 1000,
  },
  cron: {
    expression: "0 0 * * *", // Daily at midnight
    enabled: true,
    defaultPayload: {
      olderThanDays: 30,
      batchSize: 1000,
    },
  },
};
