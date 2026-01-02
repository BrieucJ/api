import type { AppRouteHandler } from "@/utils/types";
import type { GetRoute } from "./health.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createQueryBuilder } from "@/db/querybuilder";
import { workerStats } from "@/db/models/workerStats";
import { SERVER_START_TIME } from "@/api/index";
import { logger } from "@/utils/logger";

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
  const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);
  await statsQuery.getFirst();
  const responseTime = Date.now() - start;
  return {
    status: "healthy" as const,
    responseTime,
    connected: true,
  };
}

async function checkWorkerHealth() {
  const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);
  const latestStat = await statsQuery.getFirst({
    order_by: "last_heartbeat",
    order: "desc",
  });

  if (!latestStat) {
    return {
      status: "unknown" as const,
      workerMode: "unknown" as const,
      error: "No worker heartbeat detected",
    };
  }

  if (!latestStat?.last_heartbeat) {
    return {
      status: "unknown" as const,
      workerMode: "unknown" as const,
      error: "Worker heartbeat missing",
    };
  }

  const heartbeatAge = Math.floor(
    (Date.now() - new Date(latestStat.last_heartbeat).getTime()) / 1000
  );
  const isHealthy = heartbeatAge < 300; // 5 minutes

  return {
    status: isHealthy ? ("healthy" as const) : ("unhealthy" as const),
    workerMode: latestStat.worker_mode as "local" | "lambda",
    lastHeartbeat: new Date(latestStat.last_heartbeat).toISOString(),
    heartbeatAge,
    queueSize: latestStat.queue_size,
    processingCount: latestStat.processing_count,
    ...(isHealthy ? {} : { error: `Heartbeat is ${heartbeatAge}s old` }),
  };
}

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const handlerStart = Date.now();

  try {
    const [dbResult, workerResult] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkWorkerHealth(),
    ]);

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

    let status: "healthy" | "unhealthy" | "degraded";
    if (dbHealth.status === "unhealthy") {
      status = "unhealthy";
    } else if (workerHealth.status !== "healthy") {
      status = "degraded";
    } else {
      status = "healthy";
    }

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

    return response;
  } catch (error) {
    const totalTime = Date.now() - handlerStart;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[Health] Health check error", {
      totalTime,
      error: errorMessage,
    });

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
            error: errorMessage || "Health check error",
          },
          worker: {
            status: "unknown" as const,
            workerMode: "unknown" as const,
            error: errorMessage || "Health check error",
          },
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};
