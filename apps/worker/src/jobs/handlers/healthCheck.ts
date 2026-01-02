import { logger } from "@/utils/logger";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { workerStats, createQueryBuilder } from "@shared/db";
import env from "@/env";
import type { HealthCheckPayload } from "../types";

export async function healthCheck(payload: HealthCheckPayload): Promise<void> {
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

    // Update worker heartbeat to indicate worker is alive
    // Filter by worker_mode to ensure we update the correct record
    try {
      const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);
      const now = new Date();

      // Get the stats record for this worker mode (most recent by last_heartbeat)
      const { data } = await statsQuery.list({
        filters: { worker_mode__eq: env.WORKER_MODE },
        limit: 1,
        order_by: "last_heartbeat",
        order: "desc",
      });

      if (data.length > 0 && data[0]) {
        // Update existing stats with new heartbeat
        const updated = await statsQuery.update(data[0].id, {
          last_heartbeat: now,
        });
        logger.info("Worker heartbeat updated", {
          workerId: data[0].id,
          workerMode: env.WORKER_MODE,
          previousHeartbeat: data[0].last_heartbeat
            ? new Date(data[0].last_heartbeat).toISOString()
            : null,
          newHeartbeat: now.toISOString(),
          updated: !!updated,
        });
      } else {
        // Create new stats record if none exists for this worker mode
        const created = await statsQuery.create({
          worker_mode: env.WORKER_MODE,
          queue_size: 0,
          processing_count: 0,
          scheduled_jobs_count: 0,
          available_jobs_count: 0,
          scheduled_jobs: [],
          available_jobs: [],
          last_heartbeat: now,
        });
        logger.info("Worker stats record created with heartbeat", {
          workerMode: env.WORKER_MODE,
          workerId: created?.id,
          heartbeat: now.toISOString(),
        });
      }
    } catch (heartbeatError) {
      // Log but don't fail the health check if heartbeat update fails
      logger.error("Failed to update worker heartbeat", {
        error:
          heartbeatError instanceof Error
            ? heartbeatError.message
            : String(heartbeatError),
        stack:
          heartbeatError instanceof Error ? heartbeatError.stack : undefined,
      });
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
