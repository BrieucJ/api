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
    await db.execute(sql`SELECT 1`);
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
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}

async function checkWorkerHealth() {
  try {
    const latestStats = await db
      .select()
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
    return {
      status: "unhealthy" as const,
      workerMode: "unknown" as const,
      error: error instanceof Error ? error.message : "Worker check failed",
    };
  }
}

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const [dbHealth, workerHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkWorkerHealth(),
  ]);

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
};
