import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Health"];

// Database health schema
export const databaseHealthSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]).openapi({ example: "healthy" }),
  responseTime: z
    .number()
    .openapi({ example: 15, description: "Query response time in ms" }),
  connected: z.boolean().openapi({ example: true }),
  error: z.string().optional().openapi({ example: "Connection timeout" }),
});

// Worker health schema
export const workerHealthSchema = z.object({
  status: z
    .enum(["healthy", "unhealthy", "unknown"])
    .openapi({ example: "healthy" }),
  workerMode: z
    .enum(["local", "lambda", "unknown"])
    .optional()
    .openapi({ example: "lambda" }),
  lastHeartbeat: z
    .string()
    .datetime()
    .optional()
    .openapi({ example: "2024-01-01T00:00:00.000Z" }),
  heartbeatAge: z
    .number()
    .optional()
    .openapi({ example: 30, description: "Seconds since last heartbeat" }),
  queueSize: z.number().optional().openapi({ example: 5 }),
  processingCount: z.number().optional().openapi({ example: 2 }),
  error: z
    .string()
    .optional()
    .openapi({ example: "No worker heartbeat detected" }),
});

// Overall health schema
export const healthSchema = z.object({
  status: z
    .enum(["healthy", "unhealthy", "degraded"])
    .openapi({ example: "healthy" }),
  timestamp: z
    .string()
    .datetime()
    .openapi({ example: "2024-01-01T00:00:00.000Z" }),
  uptime: z
    .number()
    .openapi({ example: 3600, description: "Server uptime in seconds" }),
  database: databaseHealthSchema,
  worker: workerHealthSchema,
});

export const get = createRoute({
  tags,
  method: "get",
  path: "health",
  summary: "Health check",
  description: "Comprehensive health check including all dependencies",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema("All systems healthy", healthSchema),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "One or more systems unhealthy",
      healthSchema
    ),
  },
});

export type GetRoute = typeof get;
