import type { AppRouteHandler } from "@/utils/types";
import type {
  GetJobsRoute,
  GetQueueStatsRoute,
  GetScheduledJobsRoute,
  GetStatsRoute,
} from "./worker.routes";
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
      throw new Error("Worker stats not available");
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

    return stats;
  } catch (error) {
    logger.error("Failed to fetch worker stats from database", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const getJobs: AppRouteHandler<GetJobsRoute> = async (c) => {
  try {
    const stats = await getWorkerStatsFromDB();

    const data = {
      jobs: stats.available_jobs as Array<{
        type: string;
        name: string;
        description: string;
        payloadSchema: any;
        defaultOptions: {
          maxAttempts?: number;
          delay?: number;
          scheduledFor?: string;
        };
        category?: string;
        settings?: Record<string, unknown>;
      }>,
    };

    return c.json(
      {
        data,
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    return c.json(
      {
        data: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch jobs from worker",
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};

export const getQueueStats: AppRouteHandler<GetQueueStatsRoute> = async (c) => {
  try {
    const stats = await getWorkerStatsFromDB();

    const data = {
      queueSize: stats.queue_size,
      processingCount: stats.processing_count,
      mode: stats.worker_mode,
    };

    return c.json(
      {
        data,
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    return c.json(
      {
        data: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch queue stats from worker",
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};

export const getScheduledJobs: AppRouteHandler<GetScheduledJobsRoute> = async (
  c
) => {
  try {
    const stats = await getWorkerStatsFromDB();

    const data = {
      jobs: stats.scheduled_jobs as Array<{
        id: string;
        cronExpression: string;
        jobType: string;
        payload: unknown;
        enabled: boolean;
      }>,
    };

    return c.json(
      {
        data,
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    return c.json(
      {
        data: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch scheduled jobs from worker",
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
  try {
    const stats = await getWorkerStatsFromDB();

    const data = {
      queue: {
        queueSize: stats.queue_size,
        processingCount: stats.processing_count,
        mode: stats.worker_mode,
      },
      scheduler: {
        scheduledJobsCount: stats.scheduled_jobs_count,
        jobs: stats.scheduled_jobs as Array<{
          id: string;
          cronExpression: string;
          jobType: string;
          payload: unknown;
          enabled: boolean;
        }>,
      },
      availableJobs: {
        count: stats.available_jobs_count,
        jobs: stats.available_jobs as Array<{
          type: string;
          name: string;
          description: string;
          category?: string;
        }>,
      },
      mode: stats.worker_mode,
    };

    return c.json(
      {
        data,
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    return c.json(
      {
        data: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch worker stats",
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
    );
  }
};
