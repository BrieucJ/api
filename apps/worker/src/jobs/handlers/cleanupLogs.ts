import { logger } from "@/utils/logger";
import { db } from "@/db/client";
import { logs } from "@shared/db";
import { sql } from "drizzle-orm";
import type { CleanupLogsPayload } from "../types";

export async function cleanupLogs(payload: CleanupLogsPayload): Promise<void> {
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
}
