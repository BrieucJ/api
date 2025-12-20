import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { db } from "@/db/client";
import { metrics, metricsInsertSchema } from "@/db/models/metrics";
import { generateRowEmbedding } from "@/utils/encode";
import env from "@/env";

interface RequestMetric {
  latency: number;
  isError: boolean;
  requestSize: number;
  responseSize: number;
}

interface EndpointMetrics {
  latencies: number[];
  errors: number;
  total: number;
  requestSizes: number[];
  responseSizes: number[];
}

interface MetricsWindow {
  endpoint: string;
  start: number;
  end: number;
  metrics: EndpointMetrics;
}

// In-memory metrics storage
const metricsBuffer = new Map<string, MetricsWindow>();
const METRICS_WINDOW_SECONDS = parseInt(process.env.METRICS_WINDOW_SECONDS || "60", 10);
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

// Calculate percentile from sorted array
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

// Get current window key
function getWindowKey(endpoint: string, timestamp: number): string {
  const windowStart = Math.floor(timestamp / (METRICS_WINDOW_SECONDS * 1000)) * (METRICS_WINDOW_SECONDS * 1000);
  return `${endpoint}:${windowStart}`;
}

// Flush metrics to database
async function flushMetrics() {
  const now = Date.now();
  const windowsToFlush: MetricsWindow[] = [];

  for (const [key, window] of metricsBuffer.entries()) {
    // Flush windows that are complete (past their end time)
    if (window.end < now) {
      windowsToFlush.push(window);
      metricsBuffer.delete(key);
    }
  }

  if (windowsToFlush.length === 0) return;

  const inserts = windowsToFlush.map((window) => {
    const sortedLatencies = [...window.metrics.latencies].sort((a, b) => a - b);
    const p50 = percentile(sortedLatencies, 50);
    const p95 = percentile(sortedLatencies, 95);
    const p99 = percentile(sortedLatencies, 99);
    const errorRate = window.metrics.total > 0 ? window.metrics.errors / window.metrics.total : 0;
    const avgRequestSize = window.metrics.requestSizes.length > 0
      ? Math.round(window.metrics.requestSizes.reduce((a, b) => a + b, 0) / window.metrics.requestSizes.length)
      : null;
    const avgResponseSize = window.metrics.responseSizes.length > 0
      ? Math.round(window.metrics.responseSizes.reduce((a, b) => a + b, 0) / window.metrics.responseSizes.length)
      : null;

    return metricsInsertSchema.parse({
      windowStart: new Date(window.start),
      windowEnd: new Date(window.end),
      endpoint: window.endpoint,
      p50Latency: Math.round(p50),
      p95Latency: Math.round(p95),
      p99Latency: Math.round(p99),
      errorRate,
      trafficCount: window.metrics.total,
      requestSize: avgRequestSize,
      responseSize: avgResponseSize,
    });
  });

  try {
    for (const data of inserts) {
      await db.insert(metrics).values({
        ...data,
        embedding: generateRowEmbedding(data),
      });
    }
  } catch (error) {
    console.error("[Metrics] Failed to flush metrics:", error);
  }
}

// Start periodic flushing
let flushInterval: Timer | null = null;
if (typeof setInterval !== "undefined") {
  flushInterval = setInterval(flushMetrics, FLUSH_INTERVAL_MS);
}

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    if (flushInterval) clearInterval(flushInterval);
    flushMetrics();
  });
  process.on("SIGINT", () => {
    if (flushInterval) clearInterval(flushInterval);
    flushMetrics();
  });
}

const metricsMiddleware = createMiddleware(async (c: Context, next) => {
  const start = Date.now();
  const endpoint = c.req.path;
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
    const isError = status >= 400;

    // Try to get response size from Content-Length header
    const responseContentLength = c.res.headers.get("content-length");
    if (responseContentLength) {
      responseSize = parseInt(responseContentLength, 10) || 0;
    }

    // Record metric
    const timestamp = Date.now();
    const windowKey = getWindowKey(endpoint, timestamp);
    const windowStart = Math.floor(timestamp / (METRICS_WINDOW_SECONDS * 1000)) * (METRICS_WINDOW_SECONDS * 1000);
    const windowEnd = windowStart + METRICS_WINDOW_SECONDS * 1000;

    if (!metricsBuffer.has(windowKey)) {
      metricsBuffer.set(windowKey, {
        endpoint,
        start: windowStart,
        end: windowEnd,
        metrics: {
          latencies: [],
          errors: 0,
          total: 0,
          requestSizes: [],
          responseSizes: [],
        },
      });
    }

    const window = metricsBuffer.get(windowKey)!;
    window.metrics.latencies.push(duration);
    window.metrics.total++;
    if (isError) window.metrics.errors++;
    if (requestSize > 0) window.metrics.requestSizes.push(requestSize);
    if (responseSize > 0) window.metrics.responseSizes.push(responseSize);
  } catch (error) {
    const duration = Date.now() - start;
    const isError = true;

    // Record error metric
    const timestamp = Date.now();
    const windowKey = getWindowKey(endpoint, timestamp);
    const windowStart = Math.floor(timestamp / (METRICS_WINDOW_SECONDS * 1000)) * (METRICS_WINDOW_SECONDS * 1000);
    const windowEnd = windowStart + METRICS_WINDOW_SECONDS * 1000;

    if (!metricsBuffer.has(windowKey)) {
      metricsBuffer.set(windowKey, {
        endpoint,
        start: windowStart,
        end: windowEnd,
        metrics: {
          latencies: [],
          errors: 0,
          total: 0,
          requestSizes: [],
          responseSizes: [],
        },
      });
    }

    const window = metricsBuffer.get(windowKey)!;
    window.metrics.latencies.push(duration);
    window.metrics.total++;
    window.metrics.errors++;
    if (requestSize > 0) window.metrics.requestSizes.push(requestSize);

    throw error;
  }
});

export default metricsMiddleware;

