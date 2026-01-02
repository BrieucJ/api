import type { AppRouteHandler } from "@/utils/types";
import type { GetRoute } from "./health.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createQueryBuilder } from "@/db/querybuilder";
import { workerStats } from "@/db/models/workerStats";
import { SERVER_START_TIME } from "@/api/index";
import { logger } from "@/utils/logger";

const statsQuery = createQueryBuilder(workerStats);

// Lambda container initialization time (persists across invocations in the same container)
let CONTAINER_START_TIME: number | null = null;

if (
  typeof process.env.AWS_LAMBDA_FUNCTION_NAME !== "undefined" &&
  CONTAINER_START_TIME === null
) {
  CONTAINER_START_TIME = Date.now();
}

function getUptime(): number {
  const startTime = CONTAINER_START_TIME ?? SERVER_START_TIME;
  return Math.floor((Date.now() - startTime) / 1000);
}

async function checkDatabaseHealth() {
  const start = Date.now();
  logger.info("[Health] Starting database health check");
  try {
    const queryStart = Date.now();
    await statsQuery.list({ limit: 1 });
    const queryTime = Date.now() - queryStart;
    const responseTime = Date.now() - start;
    logger.info("[Health] Database check completed", {
      queryTime,
      totalTime: responseTime,
    });
    return {
      status: "healthy" as const,
      responseTime,
      connected: true,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Database connection failed";
    logger.error("[Health] Database check failed", {
      responseTime,
      error: errorMessage,
    });
    return {
      status: "unhealthy" as const,
      responseTime,
      connected: false,
      error: errorMessage,
    };
  }
}

async function checkWorkerHealth() {
  const start = Date.now();
  logger.info("[Health] Starting worker health check");
  try {
    const queryStart = Date.now();
    logger.info("[Health] Executing worker stats query");

    const { data: latestStats } = await statsQuery.list({
      limit: 1,
      order_by: "id",
      order: "desc",
    });
    const queryTime = Date.now() - queryStart;
    logger.info("[Health] Worker stats query completed", {
      queryTime,
      rowCount: latestStats?.length || 0,
    });

    const processingStart = Date.now();
    if (!latestStats || latestStats.length === 0) {
      const totalTime = Date.now() - start;
      logger.info("[Health] Worker check completed - no stats", {
        queryTime,
        totalTime,
      });
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "No worker heartbeat detected",
      };
    }

    const stats = latestStats[0];
    if (!stats?.last_heartbeat) {
      const totalTime = Date.now() - start;
      logger.info("[Health] Worker check completed - missing heartbeat", {
        queryTime,
        totalTime,
      });
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "Worker heartbeat missing",
      };
    }

    const heartbeatAge = Math.floor(
      (Date.now() - new Date(stats.last_heartbeat).getTime()) / 1000
    );

    const isHealthy = heartbeatAge < 300; // 5 minutes
    const processingTime = Date.now() - processingStart;
    const totalTime = Date.now() - start;

    logger.info("[Health] Worker check completed", {
      queryTime,
      processingTime,
      totalTime,
      heartbeatAge,
    });

    return {
      status: isHealthy ? ("healthy" as const) : ("unhealthy" as const),
      workerMode: stats.worker_mode as "local" | "lambda",
      lastHeartbeat: new Date(stats.last_heartbeat).toISOString(),
      heartbeatAge,
      queueSize: stats.queue_size,
      processingCount: stats.processing_count,
      ...(isHealthy ? {} : { error: `Heartbeat is ${heartbeatAge}s old` }),
    };
  } catch (error) {
    const totalTime = Date.now() - start;
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Worker check failed";
    logger.error("[Health] Worker check failed", {
      totalTime,
      error: errorMessage,
    });
    return {
      status: "unhealthy" as const,
      workerMode: "unknown" as const,
      error: errorMessage,
    };
  }
}

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const handlerStart = Date.now();
  logger.info("[Health] Health check endpoint called");

  try {
    const checksStart = Date.now();
    // Use Promise.allSettled to ensure we always get results even if one fails
    const [dbResult, workerResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkWorkerHealth(),
    ]);
    const checksTime = Date.now() - checksStart;
    logger.info("[Health] All checks completed", { checksTime });

    // Extract results, with fallback to unhealthy if promise rejected
    const dbHealth =
      dbResult.status === "fulfilled"
        ? dbResult.value
        : {
            status: "unhealthy" as const,
            responseTime: 0,
            connected: false,
            error:
              dbResult.reason instanceof Error
                ? dbResult.reason.message
                : "Database health check failed",
          };

    const workerHealth =
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

    const processingStart = Date.now();
    let status: "healthy" | "unhealthy" | "degraded";
    if (dbHealth.status === "unhealthy") {
      status = "unhealthy";
    } else if (workerHealth.status !== "healthy") {
      status = "degraded";
    } else {
      status = "healthy";
    }

    const responseStart = Date.now();
    const response = c.json(
      {
        data: {
          status,
          timestamp: new Date().toISOString(),
          uptime: getUptime(),
          database: dbHealth,
          worker: workerHealth,
        },
        error: null,
        metadata: null,
      },
      status === "unhealthy"
        ? HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
        : HTTP_STATUS_CODES.OK
    );
    const responseTime = Date.now() - responseStart;
    const processingTime = Date.now() - processingStart;
    const totalTime = Date.now() - handlerStart;

    logger.info("[Health] Health check completed", {
      totalTime,
      checksTime,
      processingTime,
      responseTime,
      dbResponseTime: dbHealth.responseTime,
      status,
    });

    return response;
  } catch (error) {
    const totalTime = Date.now() - handlerStart;
    logger.error("[Health] Health check error", { totalTime, error });
    // Never return 500 - always return proper response
    return c.json(
      {
        data: {
          status: "unhealthy" as const,
          timestamp: new Date().toISOString(),
          uptime: getUptime(),
          database: {
            status: "unhealthy" as const,
            responseTime: 0,
            connected: false,
            error: "Health check error",
          },
          worker: {
            status: "unknown" as const,
            workerMode: "unknown" as const,
            error: "Health check error",
          },
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};
