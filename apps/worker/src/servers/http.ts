import { getQueue } from "@/queue";
import { getScheduler } from "@/scheduler";
import { logger } from "@/utils/logger";
import type { Job } from "@/jobs/types";
import { getAllJobs } from "@/jobs/registry";
import env from "@/env";
import { LocalQueue } from "@/queue/local";
import { LocalScheduler } from "@/scheduler/local";

const PORT = env.PORT;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // POST /jobs/enqueue - Enqueue a job from the backend
    if (url.pathname === "/jobs/enqueue" && req.method === "POST") {
      try {
        const jobData = (await req.json()) as unknown;

        // Validate job structure
        if (
          !jobData ||
          typeof jobData !== "object" ||
          !("type" in jobData) ||
          !("payload" in jobData)
        ) {
          return new Response(JSON.stringify({ error: "Invalid job format" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const job = jobData as Job;

        const queue = getQueue();
        const jobId = await queue.enqueue(job.type, job.payload, {
          maxAttempts: job.maxAttempts,
          scheduledFor: job.scheduledFor
            ? new Date(job.scheduledFor)
            : undefined,
        });

        logger.info("Job enqueued via HTTP", {
          jobId: job.id || jobId,
          type: job.type,
        });

        return new Response(
          JSON.stringify({ success: true, jobId: job.id || jobId }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (error) {
        logger.error("Failed to enqueue job via HTTP", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({ error: "Failed to enqueue job" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /worker/jobs - List all available jobs with metadata
    if (url.pathname === "/worker/jobs" && req.method === "GET") {
      try {
        const jobs = getAllJobs();
        // Convert Zod schemas to JSON-serializable format
        const jobsData = jobs.map((job) => ({
          ...job,
          payloadSchema: job.payloadSchema._def
            ? {
                type: job.payloadSchema._def.typeName || "object",
                description: job.payloadSchema.description || "",
              }
            : {},
        }));

        return new Response(JSON.stringify({ jobs: jobsData }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error("Failed to get jobs", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({ error: "Failed to get jobs" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // GET /worker/queue/stats - Queue statistics
    if (url.pathname === "/worker/queue/stats" && req.method === "GET") {
      try {
        const queue = getQueue();
        let stats: {
          queueSize: number;
          processingCount: number;
          mode: string;
        };

        if (queue instanceof LocalQueue) {
          stats = {
            queueSize: queue.getQueueSize(),
            processingCount: queue.getProcessingCount(),
            mode: "local",
          };
        } else {
          // SQS queue - limited stats available
          stats = {
            queueSize: 0,
            processingCount: 0,
            mode: "sqs",
          };
        }

        return new Response(JSON.stringify(stats), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error("Failed to get queue stats", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({ error: "Failed to get queue stats" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // GET /worker/scheduler/jobs - List scheduled cron jobs
    if (url.pathname === "/worker/scheduler/jobs" && req.method === "GET") {
      try {
        const scheduler = getScheduler();
        let scheduledJobs: unknown[] = [];

        if (scheduler instanceof LocalScheduler) {
          scheduledJobs = scheduler.list();
        } else {
          // EventBridge scheduler - limited info available
          scheduledJobs = [];
        }

        return new Response(JSON.stringify({ jobs: scheduledJobs }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error("Failed to get scheduled jobs", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({ error: "Failed to get scheduled jobs" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // GET /worker/stats - Combined worker statistics
    if (url.pathname === "/worker/stats" && req.method === "GET") {
      try {
        const queue = getQueue();
        const scheduler = getScheduler();
        const jobs = getAllJobs();

        let queueStats: {
          queueSize: number;
          processingCount: number;
          mode: string;
        };

        if (queue instanceof LocalQueue) {
          queueStats = {
            queueSize: queue.getQueueSize(),
            processingCount: queue.getProcessingCount(),
            mode: "local",
          };
        } else {
          queueStats = {
            queueSize: 0,
            processingCount: 0,
            mode: "sqs",
          };
        }

        let scheduledJobs: unknown[] = [];
        if (scheduler instanceof LocalScheduler) {
          scheduledJobs = scheduler.list();
        }

        const stats = {
          queue: queueStats,
          scheduler: {
            scheduledJobsCount: scheduledJobs.length,
            jobs: scheduledJobs,
          },
          availableJobs: {
            count: jobs.length,
            jobs: jobs.map((job) => ({
              type: job.type,
              name: job.name,
              description: job.description,
              category: job.category,
            })),
          },
          mode: env.WORKER_MODE,
        };

        return new Response(JSON.stringify(stats), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error("Failed to get worker stats", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response(
          JSON.stringify({ error: "Failed to get worker stats" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

logger.info(`🔧 Worker HTTP server running on http://localhost:${PORT}`);

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down HTTP server...`);
  server.stop();
  logger.info("HTTP server shutdown complete");
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default server;
