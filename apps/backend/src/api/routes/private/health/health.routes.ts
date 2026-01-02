import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Health"];

// Base health status schema
export const healthStatusSchema = z.object({
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
});

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
export const overallHealthSchema = healthStatusSchema.extend({
  database: databaseHealthSchema,
  worker: workerHealthSchema,
});

// Routes
export const getLiveness = createRoute({
  tags,
  method: "get",
  path: "health/liveness",
  summary: "Liveness probe",
  description: "Basic liveness check - returns 200 if the API is running",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema("API is alive", healthStatusSchema),
  },
});

export const getReadiness = createRoute({
  tags,
  method: "get",
  path: "health/readiness",
  summary: "Readiness probe",
  description:
    "Readiness check - verifies all dependencies (database, worker) are ready",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "API is ready to serve requests",
      overallHealthSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "API is not ready - dependencies are unhealthy",
      overallHealthSchema
    ),
  },
});

export const getDatabaseHealth = createRoute({
  tags,
  method: "get",
  path: "health/database",
  summary: "Database health check",
  description: "Checks database connectivity and response time",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Database is healthy",
      databaseHealthSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Database is unhealthy",
      databaseHealthSchema
    ),
  },
});

export const getWorkerHealth = createRoute({
  tags,
  method: "get",
  path: "health/worker",
  summary: "Worker health check",
  description: "Checks worker status via heartbeat and queue metrics",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Worker is healthy",
      workerHealthSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker is unhealthy",
      workerHealthSchema
    ),
  },
});

export const get = createRoute({
  tags,
  method: "get",
  path: "health",
  summary: "Overall health check",
  description: "Comprehensive health check including all dependencies",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "All systems healthy",
      overallHealthSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "One or more systems unhealthy",
      overallHealthSchema
    ),
  },
});

export type GetRoute = typeof get;
export type GetLivenessRoute = typeof getLiveness;
export type GetReadinessRoute = typeof getReadiness;
export type GetDatabaseHealthRoute = typeof getDatabaseHealth;
export type GetWorkerHealthRoute = typeof getWorkerHealth;
