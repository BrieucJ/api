import type { AppRouteHandler } from "@/utils/types";
import type { GetRoute } from "./health.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { workerStats } from "@/db/models/workerStats";
import { desc } from "drizzle-orm";
import { SERVER_START_TIME } from "@/api/index";

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
  try {
    // Use a simple, fast query - just check if we can connect
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - start;
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
    return {
      status: "unhealthy" as const,
      responseTime,
      connected: false,
      error: errorMessage,
    };
  }
}

async function checkWorkerHealth() {
  try {
    // Optimize query - only select needed columns and limit to 1
    const latestStats = await db
      .select({
        worker_mode: workerStats.worker_mode,
        last_heartbeat: workerStats.last_heartbeat,
        queue_size: workerStats.queue_size,
        processing_count: workerStats.processing_count,
      })
      .from(workerStats)
      .orderBy(desc(workerStats.last_heartbeat))
      .limit(1);

    if (!latestStats || latestStats.length === 0) {
      return {
        status: "unknown" as const,
        workerMode: "unknown" as const,
        error: "No worker heartbeat detected",
      };
    }

    const stats = latestStats[0];
    if (!stats?.last_heartbeat) {
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Worker check failed";
    return {
      status: "unhealthy" as const,
      workerMode: "unknown" as const,
      error: errorMessage,
    };
  }
}

export const get: AppRouteHandler<GetRoute> = async (c) => {
  try {
    // Use Promise.allSettled to ensure we always get results even if one fails
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

    return c.json(
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
  } catch (error) {
    // Catch any unexpected errors and return a proper response (never 500)
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
