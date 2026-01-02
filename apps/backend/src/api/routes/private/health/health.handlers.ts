import type { AppRouteHandler } from "@/utils/types";
import type {
  GetRoute,
  GetLivenessRoute,
  GetReadinessRoute,
  GetDatabaseHealthRoute,
  GetWorkerHealthRoute,
} from "./health.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { workerStats } from "@/db/models/workerStats";
import { desc } from "drizzle-orm";
import { SERVER_START_TIME } from "@/api/index";
import { createQueryBuilder } from "@/db/querybuilder";

// Lambda container initialization time (persists across invocations in the same container)
// In Lambda, the module is loaded once per container, so this variable persists for the container lifetime
// For non-Lambda environments, this will be null and we'll use SERVER_START_TIME instead
let CONTAINER_START_TIME: number | null = null;

// Initialize container start time on first module load (for Lambda container reuse)
if (
  typeof process.env.AWS_LAMBDA_FUNCTION_NAME !== "undefined" &&
  CONTAINER_START_TIME === null
) {
  CONTAINER_START_TIME = Date.now();
}

// Helper to get server uptime in seconds
// In Lambda, use container start time if available (persists across invocations in the same container)
// Otherwise, use server start time (for HTTP server or first Lambda invocation)
function getUptime(): number {
  const startTime = CONTAINER_START_TIME ?? SERVER_START_TIME;
  return Math.floor((Date.now() - startTime) / 1000);
}

// Helper to add timeout to a promise
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Check database health by running a simple query
 * Uses a 5-second timeout to prevent hanging requests
 */
async function checkDatabaseHealth() {
  const start = Date.now();
  const DB_TIMEOUT_MS = 5000; // 5 seconds timeout

  try {
    // Simple query to check connection with timeout
    await withTimeout(
      db.execute(sql`SELECT 1 as health_check`),
      DB_TIMEOUT_MS,
      "Database query timed out after 5 seconds"
    );
    const responseTime = Date.now() - start;

    return {
      status: "healthy" as const,
      responseTime,
      connected: true,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    return {
      status: "unhealthy" as const,
      responseTime,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

/**
 * Check worker health by examining last heartbeat
 * Uses querybuilder and includes timeout handling
 */
async function checkWorkerHealth() {
  const WORKER_CHECK_TIMEOUT_MS = 5000; // 5 seconds timeout

  try {
    // Use querybuilder for consistent behavior
    const query = createQueryBuilder(workerStats);

    // Get the most recent worker stats entry with timeout
    const { data: latestStats } = await withTimeout(
      query.list({
        limit: 1,
        order_by: "last_heartbeat",
        order: "desc",
      }),
      WORKER_CHECK_TIMEOUT_MS,
      "Worker health check query timed out after 5 seconds"
    );

    if (!latestStats || latestStats.length === 0) {
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "No worker heartbeat detected",
      };
    }

    const stats = latestStats[0];
    if (!stats) {
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "Worker stats not found",
      };
    }

    const now = new Date();

    // Ensure last_heartbeat exists (should always be present due to schema, but TypeScript needs this)
    if (!stats.last_heartbeat) {
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "Worker heartbeat timestamp is missing",
      };
    }

    const lastHeartbeat = new Date(stats.last_heartbeat);
    const heartbeatAge = Math.floor(
      (now.getTime() - lastHeartbeat.getTime()) / 1000
    );

    // Consider worker unhealthy if heartbeat is older than 5 minutes (300 seconds)
    const HEARTBEAT_THRESHOLD = 300;
    const isHealthy = heartbeatAge < HEARTBEAT_THRESHOLD;

    return {
      status: isHealthy ? ("healthy" as const) : ("unhealthy" as const),
      workerMode: stats.worker_mode as "local" | "lambda",
      lastHeartbeat: lastHeartbeat.toISOString(),
      heartbeatAge,
      queueSize: stats.queue_size,
      processingCount: stats.processing_count,
      ...(isHealthy
        ? {}
        : {
            error: `Worker heartbeat is ${heartbeatAge}s old (threshold: ${HEARTBEAT_THRESHOLD}s)`,
          }),
    };
  } catch (error) {
    return {
      status: "unhealthy" as const,
      workerMode: "unknown" as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to check worker health",
    };
  }
}

/**
 * Liveness probe - simple check if API is running
 */
export const getLiveness: AppRouteHandler<GetLivenessRoute> = async (c) => {
  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
  };

  return c.json(
    {
      data: health,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

/**
 * Database health check endpoint
 */
export const getDatabaseHealth: AppRouteHandler<
  GetDatabaseHealthRoute
> = async (c) => {
  const dbHealth = await checkDatabaseHealth();
  const statusCode =
    dbHealth.status === "healthy"
      ? HTTP_STATUS_CODES.OK
      : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;

  return c.json(
    {
      data: dbHealth,
      error: null,
      metadata: null,
    },
    statusCode
  );
};

/**
 * Worker health check endpoint
 */
export const getWorkerHealth: AppRouteHandler<GetWorkerHealthRoute> = async (
  c
) => {
  const workerHealth = await checkWorkerHealth();
  const statusCode =
    workerHealth.status === "healthy"
      ? HTTP_STATUS_CODES.OK
      : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;

  return c.json(
    {
      data: workerHealth,
      error: null,
      metadata: null,
    },
    statusCode
  );
};

/**
 * Readiness probe - checks all dependencies
 * Includes error handling to prevent 500 errors
 */
export const getReadiness: AppRouteHandler<GetReadinessRoute> = async (c) => {
  try {
    // Run health checks in parallel with individual error handling
    const results = await Promise.allSettled([
      checkDatabaseHealth(),
      checkWorkerHealth(),
    ]);

    const dbResult = results[0]!;
    const workerResult = results[1]!;

    // Handle database health result
    const dbHealthResult: Awaited<ReturnType<typeof checkDatabaseHealth>> =
      dbResult.status === "fulfilled"
        ? dbResult.value
        : {
            status: "unhealthy" as const,
            connected: false,
            responseTime: 0,
            error:
              dbResult.reason instanceof Error
                ? dbResult.reason.message
                : "Database health check failed",
          };

    // Handle worker health result
    const workerHealthResult: Awaited<ReturnType<typeof checkWorkerHealth>> =
      workerResult.status === "fulfilled"
        ? workerResult.value
        : {
            status: "unhealthy" as const,
            workerMode: "unknown" as const,
            error:
              workerResult.reason instanceof Error
                ? workerResult.reason.message
                : "Worker health check failed",
          };

    // Consider ready if database is healthy, worker health is optional (degraded mode)
    const isReady = dbHealthResult.status === "healthy";
    const status = isReady
      ? workerHealthResult.status === "healthy"
        ? ("healthy" as const)
        : ("degraded" as const)
      : ("unhealthy" as const);

    const health = {
      status,
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      database: dbHealthResult,
      worker: workerHealthResult,
    };

    const statusCode = isReady
      ? HTTP_STATUS_CODES.OK
      : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;

    return c.json(
      {
        data: health,
        error: null,
        metadata: null,
      },
      statusCode
    );
  } catch (error) {
    // Catch any unexpected errors and return a proper error response
    // Still return health data structure, but with unhealthy status
    return c.json(
      {
        data: {
          status: "unhealthy" as const,
          timestamp: new Date().toISOString(),
          uptime: getUptime(),
          database: {
            status: "unhealthy" as const,
            connected: false,
            responseTime: 0,
            error: "Health check failed unexpectedly",
          },
          worker: {
            status: "unknown" as const,
            workerMode: "unknown" as const,
            error: "Health check failed unexpectedly",
          },
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};

/**
 * Overall health check - comprehensive status
 * Includes error handling to prevent 500 errors
 */
export const get: AppRouteHandler<GetRoute> = async (c) => {
  try {
    // Run health checks in parallel with individual error handling
    const results = await Promise.allSettled([
      checkDatabaseHealth(),
      checkWorkerHealth(),
    ]);

    const dbResult = results[0]!;
    const workerResult = results[1]!;

    // Handle database health result
    const dbHealthResult: Awaited<ReturnType<typeof checkDatabaseHealth>> =
      dbResult.status === "fulfilled"
        ? dbResult.value
        : {
            status: "unhealthy" as const,
            connected: false,
            responseTime: 0,
            error:
              dbResult.reason instanceof Error
                ? dbResult.reason.message
                : "Database health check failed",
          };

    // Handle worker health result
    const workerHealthResult: Awaited<ReturnType<typeof checkWorkerHealth>> =
      workerResult.status === "fulfilled"
        ? workerResult.value
        : {
            status: "unhealthy" as const,
            workerMode: "unknown" as const,
            error:
              workerResult.reason instanceof Error
                ? workerResult.reason.message
                : "Worker health check failed",
          };

    // Overall status: healthy if all healthy, degraded if some unhealthy, unhealthy if critical services down
    let status: "healthy" | "unhealthy" | "degraded";
    if (dbHealthResult.status === "unhealthy") {
      status = "unhealthy"; // Database is critical
    } else if (workerHealthResult.status !== "healthy") {
      status = "degraded"; // Worker issues are not critical
    } else {
      status = "healthy";
    }

    const health = {
      status,
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      database: dbHealthResult,
      worker: workerHealthResult,
    };

    const statusCode =
      status === "unhealthy"
        ? HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
        : HTTP_STATUS_CODES.OK;

    return c.json(
      {
        data: health,
        error: null,
        metadata: null,
      },
      statusCode
    );
  } catch (error) {
    // Catch any unexpected errors and return a proper error response
    return c.json(
      {
        data: {
          status: "unhealthy" as const,
          timestamp: new Date().toISOString(),
          uptime: getUptime(),
          database: {
            status: "unhealthy" as const,
            connected: false,
            responseTime: 0,
            error: "Health check failed unexpectedly",
          },
          worker: {
            status: "unknown" as const,
            workerMode: "unknown" as const,
            error: "Health check failed unexpectedly",
          },
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};
