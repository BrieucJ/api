import type { Job, JobType, JobOptions } from "@/jobs/types";

export interface Queue {
  enqueue<T>(
    jobType: JobType,
    payload: T,
    options?: JobOptions
  ): Promise<string>;
  dequeue(): Promise<Job | null>;
  acknowledge(jobId: string): Promise<void>;
  reject(jobId: string, error?: Error): Promise<void>;
}
