// Browser-safe: only Zod schemas, no Node.js dependencies
import { z } from "zod";
import { JobType } from "../types";
import type { JobDefinition } from "../types";

// Payload schema
export const payloadSchema = z.object({
  checkType: z.enum(["database", "queue", "scheduler"]).optional(),
});

export type HealthCheckPayload = z.infer<typeof payloadSchema>;

// Result schema
export const resultSchema = z.object({
  checks: z.record(z.string(), z.boolean()),
  workerId: z.string().optional(),
  heartbeatUpdated: z.boolean(),
});

export type HealthCheckResult = z.infer<typeof resultSchema>;

// Job definition (browser-safe)
export const definition: JobDefinition = {
  type: JobType.HEALTH_CHECK,
  name: "Health Check",
  description: "Performs health checks on database, queue, and scheduler",
  category: "monitoring",
  payloadSchema,
  resultSchema,
  defaultOptions: {
    maxAttempts: 1,
  },
  settings: {},
  cron: {
    expression: "*/5 * * * *",
    enabled: true,
    defaultPayload: {
      checkType: "database",
    },
  },
};

