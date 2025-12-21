import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Worker"];
const basePath = "worker";

// Job metadata schema
const jobMetadataSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
  payloadSchema: z.any(),
  defaultOptions: z.object({
    maxAttempts: z.number().optional(),
    delay: z.number().optional(),
    scheduledFor: z.string().datetime().optional(),
  }),
  settings: z.record(z.string(), z.unknown()).optional(),
});

// Queue stats schema
const queueStatsSchema = z.object({
  queueSize: z.number(),
  processingCount: z.number(),
  mode: z.string(),
});

// Scheduled job schema
const scheduledJobSchema = z.object({
  id: z.string(),
  cronExpression: z.string(),
  jobType: z.string(),
  payload: z.unknown(),
  enabled: z.boolean(),
});

// Worker stats schema
const workerStatsSchema = z.object({
  queue: queueStatsSchema,
  scheduler: z.object({
    scheduledJobsCount: z.number(),
    jobs: z.array(scheduledJobSchema),
  }),
  availableJobs: z.object({
    count: z.number(),
    jobs: z.array(
      z.object({
        type: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
      })
    ),
  }),
  mode: z.string(),
});

export const getJobs = createRoute({
  tags,
  method: "get",
  path: `${basePath}/jobs`,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List of available jobs",
      z.object({
        jobs: z.array(jobMetadataSchema),
      })
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker unavailable",
      z.object({
        error: z.string(),
      })
    ),
  },
});

export const getQueueStats = createRoute({
  tags,
  method: "get",
  path: `${basePath}/queue/stats`,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Queue statistics",
      queueStatsSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker unavailable",
      z.object({
        error: z.string(),
      })
    ),
  },
});

export const getScheduledJobs = createRoute({
  tags,
  method: "get",
  path: `${basePath}/scheduler/jobs`,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List of scheduled jobs",
      z.object({
        jobs: z.array(scheduledJobSchema),
      })
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker unavailable",
      z.object({
        error: z.string(),
      })
    ),
  },
});

export const getStats = createRoute({
  tags,
  method: "get",
  path: `${basePath}/stats`,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Combined worker statistics",
      workerStatsSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker unavailable",
      z.object({
        error: z.string(),
      })
    ),
  },
});

export type GetJobsRoute = typeof getJobs;
export type GetQueueStatsRoute = typeof getQueueStats;
export type GetScheduledJobsRoute = typeof getScheduledJobs;
export type GetStatsRoute = typeof getStats;
