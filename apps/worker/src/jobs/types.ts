import { z } from "zod";

export enum JobType {
  PROCESS_METRICS = "PROCESS_METRICS",
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

// Job payload schemas
export const processMetricsPayloadSchema = z.object({
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});

export const cleanupLogsPayloadSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
  batchSize: z.number().int().positive().default(1000),
});

export const healthCheckPayloadSchema = z.object({
  checkType: z.enum(["database", "queue", "scheduler"]).optional(),
});

export type ProcessMetricsPayload = z.infer<typeof processMetricsPayloadSchema>;
export type CleanupLogsPayload = z.infer<typeof cleanupLogsPayloadSchema>;
export type HealthCheckPayload = z.infer<typeof healthCheckPayloadSchema>;

