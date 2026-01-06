import { z } from "zod";
import { JobType } from "@/jobs/types";
import type { JobOptions } from "@/jobs/types";

/**
 * Typed job execution result
 * Always returns {data, error, metadata} structure
 */
export interface JobResult<T = unknown> {
  data: T | null;
  error: string | null;
  metadata: JobResultMetadata;
}

/**
 * Metadata with useful job information
 */
export interface JobResultMetadata {
  jobType: JobType;
  jobName: string;
  executionTime: number;
  attempts: number;
  maxAttempts: number;
  jobId: string;
  // Job-specific metadata
  [key: string]: unknown;
}

/**
 * Job execution context (optional environment-specific context)
 */
export interface JobExecutionContext {
  requestId?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Options for job execution
 */
export interface JobExecutionOptions extends JobOptions {
  jobId?: string;
  attempts?: number;
  context?: JobExecutionContext;
}
