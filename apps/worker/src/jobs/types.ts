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

// Re-export RawMetric from shared types
export type { RawMetric } from "@shared/types";

// Job payload schemas
export const processMetricsPayloadSchema = z.object({
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});

export const processRawMetricsPayloadSchema = z.object({
  metrics: z.array(
    z.object({
      endpoint: z.string(),
      latency: z.number(),
      status: z.number(),
      timestamp: z.number(),
      requestSize: z.number().optional(),
      responseSize: z.number().optional(),
    })
  ),
});

export const cleanupLogsPayloadSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
  batchSize: z.number().int().positive().default(1000),
});

export const healthCheckPayloadSchema = z.object({
  checkType: z.enum(["database", "queue", "scheduler"]).optional(),
});

export type ProcessMetricsPayload = z.infer<typeof processMetricsPayloadSchema>;
export type ProcessRawMetricsPayload = z.infer<
  typeof processRawMetricsPayloadSchema
>;
export type CleanupLogsPayload = z.infer<typeof cleanupLogsPayloadSchema>;
export type HealthCheckPayload = z.infer<typeof healthCheckPayloadSchema>;
