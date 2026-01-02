import type { JobType } from "@/jobs/types";

export interface CronJob {
  id: string;
  cronExpression: string;
  jobType: JobType;
  payload: unknown;
  enabled: boolean;
}

export interface Scheduler {
  schedule(
    cronExpression: string,
    jobType: JobType,
    payload: unknown
  ): Promise<string>;
  unschedule(jobId: string): Promise<void>;
  list(): CronJob[] | Promise<CronJob[]>;
}
