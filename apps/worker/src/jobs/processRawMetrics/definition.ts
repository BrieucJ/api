// Browser-safe: only Zod schemas, no Node.js dependencies
import { z } from "zod";
import { JobType } from "../types";
import type { JobDefinition } from "../types";

// Payload schema
export const payloadSchema = z.object({
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

export type ProcessRawMetricsPayload = z.infer<typeof payloadSchema>;

// Result schema
export const resultSchema = z.object({
  windowCount: z.number(),
  metricCount: z.number(),
  windowsProcessed: z.array(
    z.object({
      endpoint: z.string(),
      windowStart: z.string(),
      windowEnd: z.string(),
    })
  ),
});

export type ProcessRawMetricsResult = z.infer<typeof resultSchema>;

// Job definition (browser-safe)
export const definition: JobDefinition = {
  type: JobType.PROCESS_RAW_METRICS,
  name: "Process Raw Metrics",
  description: "Processes raw metrics and aggregates them into time windows",
  category: "metrics",
  payloadSchema,
  resultSchema,
  defaultOptions: {
    maxAttempts: 3,
  },
  settings: {
    windowSizeSeconds: 60,
  },
};
