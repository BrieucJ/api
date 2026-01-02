import { workerStats } from "@shared/db";
import { createQueryBuilder } from "@shared/db";
import { logger } from "@/utils/logger";
import { getQueue } from "@/queue";
import { getAllJobs } from "@/jobs/registry";
import { defaultCronJobs } from "@/scheduler/jobs";
import env from "@/env";
import { LocalQueue } from "@/queue/local";

export class StatsPusher {
  private intervalId?: Timer;

  async pushStats(): Promise<void> {
    try {
      const queue = getQueue();
      const availableJobsArray = getAllJobs();

      // Collect queue stats
      let queueSize = 0;
      let processingCount = 0;
      if (queue instanceof LocalQueue) {
        queueSize = queue.getQueueSize();
        processingCount = queue.getProcessingCount();
      }

      // Use scheduled jobs from code (not querying EventBridge)
      const scheduledJobsArray = defaultCronJobs.map((job) => ({
        id: `worker-cron-${job.jobType}`,
        cronExpression: job.cronExpression,
        jobType: job.jobType,
        payload: job.payload,
        enabled: job.enabled,
      }));

      // Prepare stats data
      const statsData = {
        worker_mode: env.WORKER_MODE,
        queue_size: queueSize,
        processing_count: processingCount,
        scheduled_jobs_count: scheduledJobsArray.length,
        available_jobs_count: availableJobsArray.length,
        scheduled_jobs: scheduledJobsArray,
        available_jobs: availableJobsArray.map((job) => ({
          type: job.type,
          name: job.name,
          description: job.description,
          category: job.category,
        })),
        last_heartbeat: new Date(),
      };

      // Use querybuilder for database operations
      const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);
      const { data } = await statsQuery.list({ limit: 1 });

      if (data.length > 0 && data[0]) {
        // Update existing stats
        await statsQuery.update(data[0].id, statsData);
      } else {
        // Create new stats
        await statsQuery.create(statsData);
      }

      logger.debug("Worker stats pushed to database", {
        mode: env.WORKER_MODE,
        queueSize,
        processingCount,
        scheduledJobsCount: scheduledJobsArray.length,
        availableJobsCount: availableJobsArray.length,
      });
    } catch (error) {
      logger.error("Failed to push worker stats", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  startInterval(): void {
    // Only start interval in local mode (Lambda containers are frozen between invocations)
    if (env.WORKER_MODE !== "local") {
      logger.debug("Skipping interval mode in non-local environment");
      return;
    }

    if (this.intervalId) {
      logger.warn("Stats pusher interval already running");
      return;
    }

    // Push stats every 30 seconds
    this.intervalId = setInterval(() => {
      this.pushStats().catch((error) => {
        logger.error("Error in stats push interval", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 30000);

    logger.info("Stats pusher interval started", {
      intervalMs: 30000,
      mode: env.WORKER_MODE,
    });
  }

  stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("Stats pusher interval stopped");
    }
  }
}
