import { JobType } from "@/jobs/types";
import type { CronJob } from "./types";

/**
 * Default CRON job definitions
 * These can be overridden or extended via environment variables or database
 */
export const defaultCronJobs: Omit<CronJob, "id">[] = [
  {
    cronExpression: "*/5 * * * *", // Every 5 minutes - heartbeat to keep Lambda active
    jobType: JobType.HEALTH_CHECK,
    payload: { checkType: "database" },
    enabled: true,
  },
  {
    cronExpression: "0 0 * * *", // Daily at midnight
    jobType: JobType.CLEANUP_LOGS,
    payload: { olderThanDays: 30, batchSize: 1000 },
    enabled: true,
  },
  {
    cronExpression: "*/15 * * * *", // Every 15 minutes
    jobType: JobType.PROCESS_METRICS,
    payload: {
      windowStart: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      windowEnd: new Date().toISOString(),
    },
    enabled: true,
  },
];
