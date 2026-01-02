import * as cron from "node-cron";
import { logger } from "@/utils/logger";
import { getQueue } from "@/queue";
import type { Scheduler, CronJob } from "./types";
import type { JobType } from "@/jobs/types";

export class LocalScheduler implements Scheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobDefinitions: Map<string, CronJob> = new Map();

  async schedule(
    cronExpression: string,
    jobType: JobType,
    payload: unknown
  ): Promise<string> {
    const jobId = crypto.randomUUID();

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const jobDefinition: CronJob = {
      id: jobId,
      cronExpression,
      jobType,
      payload,
      enabled: true,
    };

    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          logger.info(`Executing scheduled job ${jobType}`, {
            jobId,
            jobType,
            cronExpression,
          });

          const queue = getQueue();
          await queue.enqueue(jobType, payload);
        } catch (error) {
          logger.error(`Failed to execute scheduled job ${jobType}`, {
            jobId,
            jobType,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    this.jobs.set(jobId, task);
    this.jobDefinitions.set(jobId, jobDefinition);

    logger.info(`Scheduled job ${jobType}`, {
      jobId,
      jobType,
      cronExpression,
    });

    return jobId;
  }

  async unschedule(jobId: string): Promise<void> {
    const task = this.jobs.get(jobId);
    if (task) {
      task.stop();
      this.jobs.delete(jobId);
      this.jobDefinitions.delete(jobId);
      logger.info(`Unscheduled job ${jobId}`, { jobId });
    } else {
      logger.warn(`Job ${jobId} not found for unscheduling`, { jobId });
    }
  }

  list(): CronJob[] {
    return Array.from(this.jobDefinitions.values());
  }

  stopAll(): void {
    for (const [jobId, task] of this.jobs.entries()) {
      task.stop();
      logger.debug(`Stopped scheduled job ${jobId}`, { jobId });
    }
    this.jobs.clear();
    this.jobDefinitions.clear();
    logger.info("Stopped all scheduled jobs");
  }
}
