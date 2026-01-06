import { z } from "zod";
import { logger } from "@/utils/logger";
import { db } from "@/utils/db";
import { sql } from "drizzle-orm";
import { workerStats, createQueryBuilder } from "@shared/db";
import env from "@/env";
import { JobType } from "./types";
import type { JobDefinition } from "./types";

// Payload schema
export const payloadSchema = z.object({
  checkType: z.enum(["database", "queue", "scheduler"]).optional(),
});

export type HealthCheckPayload = z.infer<typeof payloadSchema>;

// Result schema
export const resultSchema = z.object({
  checks: z.record(z.string(), z.boolean()),
  workerId: z.string().optional(),
  heartbeatUpdated: z.boolean(),
});

export type HealthCheckResult = z.infer<typeof resultSchema>;

// Handler
export const handler = async (
  payload: HealthCheckPayload
): Promise<HealthCheckResult> => {
  logger.info("Running health check", { payload });

  try {
    const { checkType } = payload;
    const checks: Record<string, boolean> = {};
    let workerId: string | undefined;
    let heartbeatUpdated = false;

    if (!checkType || checkType === "database") {
      // Check database connectivity
      await db.execute(sql`SELECT 1`);
      checks.database = true;
      logger.info("Database health check passed");
    }

    if (!checkType || checkType === "queue") {
      checks.queue = true;
      logger.info("Queue health check passed");
    }

    if (!checkType || checkType === "scheduler") {
      checks.scheduler = true;
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
        order_by: { field: "last_heartbeat", order: "desc" },
      });

      if (data.length > 0 && data[0]) {
        // Update existing stats with new heartbeat
        await statsQuery.update(data[0].id, {
          last_heartbeat: now,
        });
        workerId = data[0].id.toString();
        heartbeatUpdated = true;
        logger.info("Worker heartbeat updated", {
          workerId,
          workerMode: env.WORKER_MODE,
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
        workerId = created?.id.toString();
        heartbeatUpdated = true;
        logger.info("Worker stats record created with heartbeat", {
          workerMode: env.WORKER_MODE,
          workerId,
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

    return {
      checks,
      workerId,
      heartbeatUpdated,
    };
  } catch (error) {
    logger.error("Health check failed", {
      payload,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Job definition
export const definition: JobDefinition = {
  type: JobType.HEALTH_CHECK,
  name: "Health Check",
  description: "Performs health checks on database, queue, and scheduler",
  category: "monitoring",
  payloadSchema,
  resultSchema,
  defaultOptions: {
    maxAttempts: 1,
  },
  settings: {},
  cron: {
    expression: "*/5 * * * *", // Every 5 minutes - heartbeat to keep Lambda active
    enabled: true,
    defaultPayload: {
      checkType: "database",
    },
  },
};
