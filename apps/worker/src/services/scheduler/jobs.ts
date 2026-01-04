import { getAllCronJobs } from "@/jobs";
import type { CronJob } from "./types";

/**
 * Default CRON job definitions
 * These are now auto-discovered from job definitions
 */
export const defaultCronJobs: Omit<CronJob, "id">[] = getAllCronJobs();

