import type { AppRouteHandler } from "@/utils/types";
import type { GetStatsRoute } from "./worker.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { logger } from "@/utils/logger";
import { createQueryBuilder } from "@/db/querybuilder";
import { workerStats } from "@/db/models";

async function getWorkerStatsFromDB() {
  try {
    const query = createQueryBuilder<typeof workerStats>(workerStats);

    // Get the most recent stats entry
    const { data } = await query.list({
      limit: 1,
      order_by: "last_heartbeat",
      order: "desc",
    });

    if (!data || data.length === 0) {
      return []; // Return empty array
    }

    const stats = data[0]!;

    // Check if stats are stale (> 60 seconds old)
    const secondsSinceLastHeartbeat =
      (Date.now() - stats.last_heartbeat.getTime()) / 1000;
    if (secondsSinceLastHeartbeat > 60) {
      logger.warn("Worker stats are stale", {
        secondsSinceLastHeartbeat: Math.round(secondsSinceLastHeartbeat),
        lastHeartbeat: stats.last_heartbeat,
      });
    }

    return data;
  } catch (error) {
    logger.error("Failed to fetch worker stats from database", {
      error: error instanceof Error ? error.message : String(error),
    });
    return []; // Return empty array on error
  }
}

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
  const statsArray = await getWorkerStatsFromDB();
  const stats = statsArray[0];

  const data = {
    queue: {
      queue_size: stats?.queue_size || 0,
      processing_count: stats?.processing_count || 0,
      mode: (stats?.worker_mode || "unknown") as "local" | "lambda" | "unknown",
    },
    scheduler: {
      scheduled_jobs_count: stats?.scheduled_jobs_count || 0,
      jobs:
        (stats?.scheduled_jobs as Array<{
          id: string;
          cronExpression: string;
          jobType: string;
          payload: unknown;
          enabled: boolean;
        }>) || [],
    },
    available_jobs: {
      count: stats?.available_jobs_count || 0,
      jobs:
        (stats?.available_jobs as Array<{
          type: string;
          name: string;
          description: string;
          category?: string;
        }>) || [],
    },
    mode: (stats?.worker_mode || "unknown") as "local" | "lambda" | "unknown",
  };

  return c.json(
    {
      data,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
