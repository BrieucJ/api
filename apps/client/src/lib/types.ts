export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// Worker types
export interface JobMetadata {
  type: string;
  name: string;
  description: string;
  category?: string;
  payloadSchema: unknown;
  defaultOptions: {
    maxAttempts?: number;
    delay?: number;
    scheduledFor?: string;
  };
  settings?: Record<string, unknown>;
}

export interface QueueStats {
  queueSize: number;
  processingCount: number;
  mode: string;
}

export interface ScheduledJob {
  id: string;
  cronExpression: string;
  jobType: string;
  payload: unknown;
  enabled: boolean;
}

export interface WorkerStats {
  queue: QueueStats;
  scheduler: {
    scheduledJobsCount: number;
    jobs: ScheduledJob[];
  };
  availableJobs: {
    count: number;
    jobs: Array<{
      type: string;
      name: string;
      description: string;
      category?: string;
    }>;
  };
  mode: string;
}
