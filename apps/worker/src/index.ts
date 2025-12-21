import env from "@/env";
import { logger } from "@/utils/logger";
import { getQueue } from "@/queue";
import { getScheduler } from "@/scheduler";
import { defaultCronJobs } from "@/scheduler/jobs";
import { getJobHandler, hasJobHandler } from "@/jobs/registry";
import type { Job } from "@/jobs/types";
import { LocalQueue } from "@/queue/local";

async function processJob(job: Job): Promise<void> {
  const { type, payload, attempts, maxAttempts } = job;

  if (attempts >= maxAttempts) {
    logger.error(`Job ${job.id} exceeded max attempts`, {
      jobId: job.id,
      type,
      attempts,
      maxAttempts,
    });
    return;
  }

  if (!hasJobHandler(type)) {
    logger.error(`No handler found for job type: ${type}`, {
      jobId: job.id,
      type,
    });
    return;
  }

  const handler = getJobHandler(type);
  if (!handler) {
    logger.error(`Handler is undefined for job type: ${type}`, {
      jobId: job.id,
      type,
    });
    return;
  }

  try {
    logger.info(`Processing job ${job.id}`, {
      jobId: job.id,
      type,
      attempts: attempts + 1,
    });

    await handler(payload as any);

    logger.info(`Completed job ${job.id}`, {
      jobId: job.id,
      type,
    });
  } catch (error) {
    logger.error(`Failed to process job ${job.id}`, {
      jobId: job.id,
      type,
      attempts: attempts + 1,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Retry logic
    if (attempts + 1 < maxAttempts) {
      const retryJob: Job = {
        ...job,
        attempts: attempts + 1,
      };

      // Exponential backoff: 2^attempts seconds
      const delay = Math.pow(2, attempts) * 1000;
      const queue = getQueue();
      await queue.enqueue(type, payload, {
        delay,
        maxAttempts,
      });

      logger.info(`Scheduled retry for job ${job.id}`, {
        jobId: job.id,
        type,
        attempts: attempts + 1,
        delay,
      });
    } else {
      logger.error(`Job ${job.id} failed after ${maxAttempts} attempts`, {
        jobId: job.id,
        type,
        maxAttempts,
      });
    }
  }
}

async function startWorker(): Promise<void> {
  // Start HTTP server if in local mode
  if (env.WORKER_MODE === "local") {
    await import("./servers/http");
  }

  const queue = getQueue();
  const scheduler = getScheduler();

  // Schedule default CRON jobs
  if (env.WORKER_MODE === "local") {
    logger.info("Scheduling default CRON jobs", {
      count: defaultCronJobs.length,
    });

    for (const jobDef of defaultCronJobs) {
      if (jobDef.enabled) {
        await scheduler.schedule(
          jobDef.cronExpression,
          jobDef.jobType,
          jobDef.payload
        );
      }
    }
  }

  // Start queue polling (only for local mode)
  if (env.WORKER_MODE === "local" && queue instanceof LocalQueue) {
    queue.startPolling(async (job) => {
      await processJob(job);
      await queue.acknowledge(job.id);
    });

    logger.info("Worker started in local mode", {
      queueSize: queue.getQueueSize(),
      processingCount: queue.getProcessingCount(),
    });
  } else {
    logger.info("Worker started in lambda mode - waiting for events");
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    if (env.WORKER_MODE === "local") {
      if (queue instanceof LocalQueue) {
        queue.stopPolling();
      }

      const { LocalScheduler } = await import("./scheduler/local");
      if (scheduler instanceof LocalScheduler) {
        scheduler.stopAll();
      }
    }

    logger.info("Worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start the worker
startWorker().catch((error) => {
  logger.fatal("Failed to start worker", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
