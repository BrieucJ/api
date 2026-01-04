import { z } from "zod";

export enum JobType {
  PROCESS_METRICS = "PROCESS_METRICS",
  PROCESS_RAW_METRICS = "PROCESS_RAW_METRICS",
  CLEANUP_LOGS = "CLEANUP_LOGS",
  HEALTH_CHECK = "HEALTH_CHECK",
}

export interface Job<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface JobHandler<T = unknown> {
  (payload: T): Promise<void>;
}

export interface JobOptions {
  maxAttempts?: number;
  delay?: number; // milliseconds
  scheduledFor?: Date;
}

export interface JobMetadata {
  type: JobType;
  name: string;
  description: string;
  category?: string;
  payloadSchema: z.ZodSchema;
  defaultOptions: JobOptions;
  settings?: Record<string, unknown>;
}

export interface CronConfig {
  expression: string;
  enabled: boolean;
  defaultPayload: unknown;
}

export interface JobDefinition extends JobMetadata {
  cron?: CronConfig;
}

// Re-export RawMetric from shared types
export type { RawMetric } from "@shared/types";
