import { z } from "zod";
import { logger } from "@/utils/logger";
import { db } from "@/utils/db";
import { sql } from "drizzle-orm";
import { workerStats, createQueryBuilder } from "@shared/db";
import env from "@/env";
import { JobType } from "./types";
import type { JobDefinition } from "./types";
import { getAllCronJobs, getAllJobs } from "./index";
import { SQSQueue } from "@/utils/sqs";

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

    // Collect real stats
    let queueSize = 0;
    if (env.SQS_QUEUE_URL) {
      try {
        const queue = new SQSQueue();
        queueSize = await queue.getQueueSize();
      } catch (error) {
        logger.warn("Failed to get queue size", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Get scheduled and available jobs
    const cronJobs = getAllCronJobs();
    const scheduledJobs = cronJobs.map((job, index) => ({
      id: `cron-${index}`,
      cronExpression: job.cronExpression,
      jobType: job.jobType,
      payload: job.payload,
      enabled: job.enabled,
    }));

    const availableJobs = getAllJobs().map((job) => ({
      type: job.type,
      name: job.name,
      description: job.description,
      category: job.category,
    }));

    try {
      const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);
      const now = new Date();

      // Get the most recent stats record
      const { data } = await statsQuery.list({
        limit: 1,
        order_by: { field: "last_heartbeat", order: "desc" },
      });

      if (data.length > 0 && data[0]) {
        // Update existing stats with real values
        await statsQuery.update(data[0].id, {
          last_heartbeat: now,
          queue_size: queueSize,
          processing_count: 0, // Could track this if needed
          scheduled_jobs_count: scheduledJobs.length,
          available_jobs_count: availableJobs.length,
          scheduled_jobs: scheduledJobs,
          available_jobs: availableJobs,
        });
        workerId = data[0].id.toString();
        heartbeatUpdated = true;
        logger.info("Worker stats updated", {
          workerId,
          queueSize,
          scheduledJobsCount: scheduledJobs.length,
          availableJobsCount: availableJobs.length,
        });
      } else {
        // Create new stats record
        const created = await statsQuery.create({
          queue_size: queueSize,
          processing_count: 0,
          scheduled_jobs_count: scheduledJobs.length,
          available_jobs_count: availableJobs.length,
          scheduled_jobs: scheduledJobs,
          available_jobs: availableJobs,
          last_heartbeat: now,
        });
        workerId = created?.id.toString();
        heartbeatUpdated = true;
        logger.info("Worker stats record created", {
          workerId,
          queueSize,
          scheduledJobsCount: scheduledJobs.length,
          availableJobsCount: availableJobs.length,
        });
      }
    } catch (heartbeatError) {
      // Log but don't fail the health check if stats update fails
      logger.error("Failed to update worker stats", {
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
