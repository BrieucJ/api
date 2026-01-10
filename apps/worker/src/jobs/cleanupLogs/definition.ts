// Browser-safe: only Zod schemas, no Node.js dependencies
import { z } from "zod";
import { JobType } from "../types";
import type { JobDefinition } from "../types";

// Payload schema
export const payloadSchema = z.object({
  olderThanDays: z.number().int().positive().default(30),
  batchSize: z.number().int().positive().default(1000),
});

export type CleanupLogsPayload = z.infer<typeof payloadSchema>;

// Result schema
export const resultSchema = z.object({
  totalDeleted: z.number(),
  batchesProcessed: z.number(),
  olderThanDays: z.number(),
});

export type CleanupLogsResult = z.infer<typeof resultSchema>;

// Job definition (browser-safe)
export const definition: JobDefinition = {
  type: JobType.CLEANUP_LOGS,
  name: "Cleanup Logs",
  description: "Removes old log entries based on retention policy",
  category: "maintenance",
  payloadSchema,
  resultSchema,
  defaultOptions: {
    maxAttempts: 3,
  },
  settings: {
    defaultOlderThanDays: 30,
    defaultBatchSize: 1000,
  },
  cron: {
    expression: "0 0 * * *",
    enabled: true,
    defaultPayload: {
      olderThanDays: 30,
      batchSize: 1000,
    },
  },
};

