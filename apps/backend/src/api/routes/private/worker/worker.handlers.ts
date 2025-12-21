import type { AppRouteHandler } from "@/utils/types";
import type {
  GetJobsRoute,
  GetQueueStatsRoute,
  GetScheduledJobsRoute,
  GetStatsRoute,
} from "./worker.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import env from "@/env";
import { logger } from "@/utils/logger";

const WORKER_URL = env.WORKER_URL || "http://localhost:8081";

async function fetchFromWorker(endpoint: string) {
  try {
    const response = await fetch(`${WORKER_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Worker returned status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error("Failed to fetch from worker", {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const getJobs: AppRouteHandler<GetJobsRoute> = async (c) => {
  try {
    const response = await fetchFromWorker("/worker/jobs");

    // Type assert to match the expected schema
    const data = response as {
      jobs: Array<{
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
      }>;
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
    const response = await fetchFromWorker("/worker/queue/stats");

    // Type assert to match queueStatsSchema
    const data = response as {
      queueSize: number;
      processingCount: number;
      mode: string;
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
    const response = await fetchFromWorker("/worker/scheduler/jobs");

    // Type assert to match the expected schema
    const data = response as {
      jobs: Array<{
        id: string;
        cronExpression: string;
        jobType: string;
        payload: unknown;
        enabled: boolean;
      }>;
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
    const response = await fetchFromWorker("/worker/stats");

    // Type assert to match workerStatsSchema
    const data = response as {
      queue: {
        queueSize: number;
        processingCount: number;
        mode: string;
      };
      scheduler: {
        scheduledJobsCount: number;
        jobs: Array<{
          id: string;
          cronExpression: string;
          jobType: string;
          payload: unknown;
          enabled: boolean;
        }>;
      };
      availableJobs: {
        count: number;
        jobs: Array<{
          type: string;
          name: string;
          description: string;
          category?: string;
        }>;
      };
      mode: string;
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
