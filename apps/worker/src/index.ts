import env from "@/env";
import { logger } from "@/utils/logger";
import { getQueue } from "@/services/queue";
import { getScheduler } from "@/services/scheduler";
import { defaultCronJobs } from "@/services/scheduler/jobs";
import { LocalQueue } from "@/services/queue/local";
import { StatsPusher } from "@/services/statsPusher";
import { processJob } from "@/utils/jobProcessor";

async function startWorker(): Promise<void> {
  // Start HTTP server if in local mode
  if (env.WORKER_MODE === "local") {
    await import("./servers/http");
  }

  const queue = getQueue();
  const scheduler = getScheduler(env.LAMBDA_ARN);

  // Initialize and start stats pusher (30s interval for both local and lambda)
  const statsPusher = new StatsPusher();
  await statsPusher.pushStats(); // Push initial stats
  statsPusher.startInterval(); // Start 30s interval
  logger.info("Stats pusher initialized", { mode: env.WORKER_MODE });

  // Schedule default CRON jobs
  logger.info("Scheduling default CRON jobs", {
    count: defaultCronJobs.length,
    mode: env.WORKER_MODE,
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

    // Stop stats pusher
    statsPusher.stopInterval();

    if (env.WORKER_MODE === "local") {
      if (queue instanceof LocalQueue) {
        queue.stopPolling();
      }

      const { LocalScheduler } = await import("./services/scheduler/local");
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
