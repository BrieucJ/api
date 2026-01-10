import { serve } from "bun";
import { logger } from "@/utils/logger";
import { getJobService } from "@/utils/jobService";
import { getAllCronJobs } from "@/jobs";
import { JobType } from "@/jobs/types";
import env from "@/env";
import * as cron from "node-cron";

// HTTP server for accepting job requests
const server = serve({
  port: env.WORKER_PORT || 8081,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", mode: "local" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Job execution endpoint
    if (url.pathname === "/jobs/execute" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          type: JobType;
          payload: unknown;
          maxAttempts?: number;
        };

        const jobService = getJobService();
        const result = await jobService.execute(body.type, body.payload, {
          maxAttempts: body.maxAttempts,
        });

        return new Response(JSON.stringify(result), {
          status: result.error ? 500 : 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error("Failed to execute job via HTTP", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Job enqueue endpoint (for async job processing)
    if (url.pathname === "/jobs/enqueue" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          id: string;
          type: JobType;
          payload: unknown;
          attempts?: number;
          maxAttempts?: number;
          createdAt?: string;
          scheduledFor?: string;
        };

        // Execute job asynchronously (fire and forget)
        // This mimics SQS behavior where jobs are enqueued and processed asynchronously
        const jobService = getJobService();
        jobService
          .execute(body.type, body.payload, {
            maxAttempts: body.maxAttempts ?? 3,
            attempts: body.attempts ?? 0,
          })
          .then((result) => {
            if (result.error) {
              logger.error("Enqueued job failed", {
                jobId: body.id,
                jobType: body.type,
                error: result.error,
              });
            } else {
              logger.debug("Enqueued job completed", {
                jobId: body.id,
                jobType: body.type,
              });
            }
          })
          .catch((error) => {
            logger.error("Enqueued job execution error", {
              jobId: body.id,
              jobType: body.type,
              error: error instanceof Error ? error.message : String(error),
            });
          });

        // Return immediately with job ID (mimics SQS behavior)
        return new Response(
          JSON.stringify({
            id: body.id,
            status: "enqueued",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        logger.error("Failed to enqueue job via HTTP", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

logger.info(`Worker running in local mode on port ${env.WORKER_PORT || 8081}`);

// Schedule cron jobs using node-cron
const cronJobs = getAllCronJobs();
logger.info(`Scheduling ${cronJobs.length} cron jobs`, {
  jobs: cronJobs.map((j) => j.jobType),
});

cronJobs.forEach((jobDef) => {
  if (jobDef.enabled) {
    cron.schedule(jobDef.cronExpression, async () => {
      logger.info(`Executing scheduled job: ${jobDef.jobType}`);
      const jobService = getJobService();
      const result = await jobService.execute(jobDef.jobType, jobDef.payload);

      if (result.error) {
        logger.error(`Scheduled job failed: ${jobDef.jobType}`, {
          error: result.error,
        });
      } else {
        logger.info(`Scheduled job completed: ${jobDef.jobType}`);
      }
    });
    logger.info(
      `Scheduled cron job: ${jobDef.jobType} (${jobDef.cronExpression})`
    );
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down worker...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down worker...");
  server.stop();
  process.exit(0);
});
