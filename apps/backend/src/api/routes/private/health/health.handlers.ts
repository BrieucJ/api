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

// Helper to get server uptime in seconds
function getUptime(): number {
  return Math.floor((Date.now() - SERVER_START_TIME) / 1000);
}

/**
 * Check database health by running a simple query
 */
async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    // Simple query to check connection
    await db.execute(sql`SELECT 1 as health_check`);
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
 */
async function checkWorkerHealth() {
  try {
    // Get the most recent worker stats entry
    const latestStats = await db
      .select()
      .from(workerStats)
      .orderBy(desc(workerStats.last_heartbeat))
      .limit(1);

    if (latestStats.length === 0) {
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "No worker heartbeat detected",
      };
    }

    const stats = latestStats[0];
    const now = new Date();
    const lastHeartbeat = new Date(stats?.last_heartbeat);
    const heartbeatAge = Math.floor(
      (now.getTime() - lastHeartbeat?.getTime() ?? 0) / 1000
    );

    // Consider worker unhealthy if heartbeat is older than 5 minutes (300 seconds)
    const HEARTBEAT_THRESHOLD = 300;
    const isHealthy = heartbeatAge < HEARTBEAT_THRESHOLD;

    return {
      status: isHealthy ? ("healthy" as const) : ("unhealthy" as const),
      workerMode: stats?.worker_mode as "local" | "lambda",
      lastHeartbeat: lastHeartbeat.toISOString(),
      heartbeatAge,
      queueSize: stats?.queue_size,
      processingCount: stats?.processing_count,
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
 */
export const getReadiness: AppRouteHandler<GetReadinessRoute> = async (c) => {
  const [dbHealth, workerHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkWorkerHealth(),
  ]);

  // Consider ready if database is healthy, worker health is optional (degraded mode)
  const isReady = dbHealth.status === "healthy";
  const status = isReady
    ? workerHealth.status === "healthy"
      ? ("healthy" as const)
      : ("degraded" as const)
    : ("unhealthy" as const);

  const health = {
    status,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    database: dbHealth,
    worker: workerHealth,
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
};

/**
 * Overall health check - comprehensive status
 */
export const get: AppRouteHandler<GetRoute> = async (c) => {
  const [dbHealth, workerHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkWorkerHealth(),
  ]);

  // Overall status: healthy if all healthy, degraded if some unhealthy, unhealthy if critical services down
  let status: "healthy" | "unhealthy" | "degraded";
  if (dbHealth.status === "unhealthy") {
    status = "unhealthy"; // Database is critical
  } else if (workerHealth.status !== "healthy") {
    status = "degraded"; // Worker issues are not critical
  } else {
    status = "healthy";
  }

  const health = {
    status,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    database: dbHealth,
    worker: workerHealth,
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
};
