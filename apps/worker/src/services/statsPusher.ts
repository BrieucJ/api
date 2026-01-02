import { workerStats } from "@shared/db";
import { db } from "@/db/db";
import { logger } from "@/utils/logger";
import { getQueue } from "@/queue";
import { getScheduler } from "@/scheduler";
import { getAllJobs } from "@/jobs/registry";
import env from "@/env";
import { LocalQueue } from "@/queue/local";
import { LocalScheduler } from "@/scheduler/local";

export class StatsPusher {
  private intervalId?: Timer;

  async pushStats(): Promise<void> {
    try {
      const queue = getQueue();
      const scheduler = getScheduler();
      const availableJobsArray = getAllJobs();

      // Collect queue stats
      let queueSize = 0;
      let processingCount = 0;
      if (queue instanceof LocalQueue) {
        queueSize = queue.getQueueSize();
        processingCount = queue.getProcessingCount();
      }

      // Collect scheduler stats
      let scheduledJobsArray: any[] = [];
      if (scheduler instanceof LocalScheduler) {
        scheduledJobsArray = scheduler.list();
      }

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

      // Upsert stats to database
      await db
        .insert(workerStats)
        .values(statsData)
        .onConflictDoUpdate({
          target: workerStats.id,
          set: {
            ...statsData,
            updated_at: new Date(),
          },
        });

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
