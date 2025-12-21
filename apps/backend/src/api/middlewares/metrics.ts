import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { enqueueJob, JobType } from "@/utils/queue";
import { logger } from "@/utils/logger";

// Raw metric data structure
interface RawMetric {
  endpoint: string;
  latency: number;
  status: number;
  timestamp: number; // Unix timestamp in milliseconds
  requestSize?: number;
  responseSize?: number;
}

// Raw metrics buffer - collect metrics and batch enqueue them
const rawMetricsBuffer: RawMetric[] = [];
const BATCH_SIZE = 50; // Enqueue in batches of 50
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds

// Flush raw metrics to worker queue
async function flushRawMetrics() {
  if (rawMetricsBuffer.length === 0) return;

  // Take up to BATCH_SIZE metrics
  const batch = rawMetricsBuffer.splice(0, BATCH_SIZE);

  try {
    await enqueueJob(JobType.PROCESS_RAW_METRICS, { metrics: batch });
  } catch (error) {
    // If enqueue fails, put metrics back (except if buffer is full)
    // In production, you might want to log to a dead letter queue
    logger.error("Failed to enqueue raw metrics", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Put metrics back at the front
    rawMetricsBuffer.unshift(...batch);
  }
}

// Start periodic flushing
let flushInterval: Timer | null = null;
if (typeof setInterval !== "undefined") {
  flushInterval = setInterval(flushRawMetrics, FLUSH_INTERVAL_MS);
}

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    if (flushInterval) clearInterval(flushInterval);
    flushRawMetrics();
  });
  process.on("SIGINT", () => {
    if (flushInterval) clearInterval(flushInterval);
    flushRawMetrics();
  });
}

const metricsMiddleware = createMiddleware(async (c: Context, next) => {
  const endpoint = c.req.path;

  // Only track public endpoints that start with /api/v1
  if (!endpoint.startsWith("/api/v1")) {
    await next();
    return;
  }

  const start = Date.now();
  let requestSize = 0;
  let responseSize = 0;

  // Try to get request size from Content-Length header or body
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    requestSize = parseInt(contentLength, 10) || 0;
  } else {
    try {
      const body = await c.req.raw.clone().text();
      requestSize = new Blob([body]).size;
    } catch {
      // Ignore if we can't read body
    }
  }

  try {
    await next();

    const duration = Date.now() - start;
    const status = c.res.status || 200;

    // Try to get response size from Content-Length header
    const responseContentLength = c.res.headers.get("content-length");
    if (responseContentLength) {
      responseSize = parseInt(responseContentLength, 10) || 0;
    }

    // Collect raw metric (non-blocking)
    const rawMetric: RawMetric = {
      endpoint,
      latency: duration,
      status,
      timestamp: Date.now(),
      requestSize: requestSize > 0 ? requestSize : undefined,
      responseSize: responseSize > 0 ? responseSize : undefined,
    };

    // Add to buffer (will be flushed periodically)
    rawMetricsBuffer.push(rawMetric);

    // If buffer is getting large, flush immediately
    if (rawMetricsBuffer.length >= BATCH_SIZE * 2) {
      // Flush in background (don't await)
      flushRawMetrics().catch((error) => {
        logger.error("Error flushing metrics", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    }
  } catch (error) {
    const duration = Date.now() - start;

    // Record error metric
    const rawMetric: RawMetric = {
      endpoint,
      latency: duration,
      status: 500, // Assume 500 for errors
      timestamp: Date.now(),
      requestSize: requestSize > 0 ? requestSize : undefined,
    };

    rawMetricsBuffer.push(rawMetric);

    // If buffer is getting large, flush immediately
    if (rawMetricsBuffer.length >= BATCH_SIZE * 2) {
      flushRawMetrics().catch((error) => {
        logger.error("Error flushing metrics", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    }

    throw error;
  }
});

export default metricsMiddleware;
