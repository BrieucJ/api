import { z } from "zod";
import { logger } from "@/utils/logger";
import { metrics, createQueryBuilder } from "@shared/db";
import { JobType } from "./types";
import type { JobDefinition } from "./types";

const METRICS_WINDOW_SECONDS = 60;

// Payload schema
export const payloadSchema = z.object({
  metrics: z.array(
    z.object({
      endpoint: z.string(),
      latency: z.number(),
      status: z.number(),
      timestamp: z.number(),
      requestSize: z.number().optional(),
      responseSize: z.number().optional(),
    })
  ),
});

export type ProcessRawMetricsPayload = z.infer<typeof payloadSchema>;

// Result schema
export const resultSchema = z.object({
  windowCount: z.number(),
  metricCount: z.number(),
  windowsProcessed: z.array(
    z.object({
      endpoint: z.string(),
      windowStart: z.string(),
      windowEnd: z.string(),
    })
  ),
});

export type ProcessRawMetricsResult = z.infer<typeof resultSchema>;

// Calculate percentile from sorted array using nearest rank method
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Nearest rank method: index = ceil((p/100) * n) - 1
  // Clamp to ensure valid array bounds
  const index = Math.max(
    0,
    Math.min(Math.ceil((p / 100) * sorted.length) - 1, sorted.length - 1)
  );
  return sorted[index] || 0;
}

// Get current window key
function getWindowKey(endpoint: string, timestamp: number): string {
  const windowStart =
    Math.floor(timestamp / (METRICS_WINDOW_SECONDS * 1000)) *
    (METRICS_WINDOW_SECONDS * 1000);
  return `${endpoint}:${windowStart}`;
}

interface MetricsWindow {
  endpoint: string;
  start: number;
  end: number;
  latencies: number[];
  errors: number;
  total: number;
  request_sizes: number[];
  response_sizes: number[];
}

// Handler
export const handler = async (
  payload: ProcessRawMetricsPayload
): Promise<ProcessRawMetricsResult> => {
  logger.debug("Starting processing", {
    metricCount: payload.metrics.length,
    sampleMetrics: payload.metrics.slice(0, 3).map((m) => ({
      status: m.status,
      endpoint: m.endpoint,
      isError: m.status >= 400,
    })),
  });

  try {
    // Group metrics by window
    const windows = new Map<string, MetricsWindow>();

    for (const metric of payload.metrics) {
      const windowStart =
        Math.floor(metric.timestamp / (METRICS_WINDOW_SECONDS * 1000)) *
        (METRICS_WINDOW_SECONDS * 1000);
      const windowEnd = windowStart + METRICS_WINDOW_SECONDS * 1000;
      const windowKey = getWindowKey(metric.endpoint, metric.timestamp);

      if (!windows.has(windowKey)) {
        windows.set(windowKey, {
          endpoint: metric.endpoint,
          start: windowStart,
          end: windowEnd,
          latencies: [],
          errors: 0,
          total: 0,
          request_sizes: [],
          response_sizes: [],
        });
      }

      const window = windows.get(windowKey)!;
      window.latencies.push(metric.latency);
      window.total++;

      // DEBUG: Log all status codes to see what we're getting
      if (metric.status >= 400) {
        logger.debug("ERROR DETECTED", {
          status: metric.status,
          endpoint: metric.endpoint,
          timestamp: metric.timestamp,
        });
        window.errors++;
      }

      // DEBUG: Log first few metrics to see status distribution
      if (window.total <= 5) {
        logger.debug("Sample metric", {
          status: metric.status,
          endpoint: metric.endpoint,
          isError: metric.status >= 400,
        });
      }
      if (metric.requestSize) {
        window.request_sizes.push(metric.requestSize);
      }
      if (metric.responseSize) {
        window.response_sizes.push(metric.responseSize);
      }
    }

    // Calculate aggregated metrics for each window
    const inserts = Array.from(windows.values()).map((window) => {
      const sortedLatencies = [...window.latencies].sort((a, b) => a - b);
      const p50 = percentile(sortedLatencies, 50);
      const p95 = percentile(sortedLatencies, 95);
      const p99 = percentile(sortedLatencies, 99);
      const errorRate = window.total > 0 ? window.errors / window.total : 0;
      const avgRequestSize =
        window.request_sizes.length > 0
          ? Math.round(
              window.request_sizes.reduce((a, b) => a + b, 0) /
                window.request_sizes.length
            )
          : null;
      const avgResponseSize =
        window.response_sizes.length > 0
          ? Math.round(
              window.response_sizes.reduce((a, b) => a + b, 0) /
                window.response_sizes.length
            )
          : null;

      // Convert errorRate to percentage (0-100) for integer storage
      // Database column is integer, so we store as percentage to preserve precision
      const errorRatePercent = Math.round(errorRate * 100);

      // Log for debugging
      logger.debug("Window calculation", {
        endpoint: window.endpoint,
        errors: window.errors,
        total: window.total,
        errorRateDecimal: errorRate,
        errorRatePercent,
        windowStart: new Date(window.start).toISOString(),
      });

      if (window.errors > 0 || errorRate > 0) {
        logger.info("Error rate calculation", {
          endpoint: window.endpoint,
          errors: window.errors,
          total: window.total,
          errorRateDecimal: errorRate,
          errorRatePercent,
          windowStart: new Date(window.start).toISOString(),
        });
      }

      // Build insert data directly - COMPLETELY bypass Zod validation
      // We need to store error_rate as percentage (0-100) in integer column
      // Explicitly ensure error_rate is an integer
      const insertData = {
        window_start: new Date(window.start),
        window_end: new Date(window.end),
        endpoint: window.endpoint,
        p50_latency: Math.round(p50),
        p95_latency: Math.round(p95),
        p99_latency: Math.round(p99),
        error_rate: Math.round(errorRatePercent) as number, // Store as percentage (0-100) for integer column - EXPLICIT INTEGER
        traffic_count: window.total,
        request_size: avgRequestSize,
        response_size: avgResponseSize,
      } as any; // Use 'as any' to bypass TypeScript type checking

      // Log BEFORE insert to verify the value
      logger.debug("INSERTING METRIC", {
        endpoint: window.endpoint,
        errors: window.errors,
        total: window.total,
        errorRateDecimal: errorRate,
        errorRatePercent,
        insertDataErrorRate: insertData.error_rate,
        windowStart: new Date(window.start).toISOString(),
      });

      if (window.errors > 0 || errorRatePercent > 0) {
        logger.info("INSERTING METRIC WITH ERROR RATE", {
          endpoint: window.endpoint,
          errors: window.errors,
          total: window.total,
          errorRateDecimal: errorRate,
          errorRatePercent,
          insertDataErrorRate: insertData.error_rate,
          windowStart: new Date(window.start).toISOString(),
        });
      }

      return insertData;
    });

    // Insert aggregated metrics into database using querybuilder
    const metricsQuery = createQueryBuilder<typeof metrics>(metrics);

    for (const data of inserts) {
      // Log before insert
      logger.debug("ABOUT TO INSERT", {
        error_rate: data.error_rate,
        endpoint: data.endpoint,
        traffic_count: data.traffic_count,
        fullData: JSON.stringify(data, null, 2),
      });

      // Log the actual data being inserted
      if ((data.error_rate as number) > 0) {
        logger.info("ABOUT TO INSERT INTO DB", {
          error_rate: data.error_rate,
          endpoint: data.endpoint,
          traffic_count: data.traffic_count,
        });
      }

      try {
        await metricsQuery.create(data as any);

        // Log after successful insert
        logger.debug("SUCCESSFULLY INSERTED", {
          error_rate: data.error_rate,
          endpoint: data.endpoint,
        });

        if ((data.error_rate as number) > 0) {
          logger.info("SUCCESSFULLY INSERTED INTO DB", {
            error_rate: data.error_rate,
            endpoint: data.endpoint,
          });
        }
      } catch (error) {
        logger.error("FAILED TO INSERT", {
          error: error instanceof Error ? error.message : String(error),
          error_rate: data.error_rate,
          endpoint: data.endpoint,
          stack: error instanceof Error ? error.stack : undefined,
        });
        logger.error("FAILED TO INSERT METRIC", {
          error: error instanceof Error ? error.message : String(error),
          data: {
            ...data,
            error_rate: data.error_rate,
          },
        });
        throw error;
      }
    }

    const windowsProcessed = Array.from(windows.values()).map((window) => ({
      endpoint: window.endpoint,
      windowStart: new Date(window.start).toISOString(),
      windowEnd: new Date(window.end).toISOString(),
    }));

    logger.info("Processed raw metrics", {
      windowCount: windows.size,
      metricCount: payload.metrics.length,
    });

    return {
      windowCount: windows.size,
      metricCount: payload.metrics.length,
      windowsProcessed,
    };
  } catch (error) {
    logger.error("Failed to process raw metrics", {
      payload,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Job definition
export const definition: JobDefinition = {
  type: JobType.PROCESS_RAW_METRICS,
  name: "Process Raw Metrics",
  description: "Processes raw metrics and aggregates them into time windows",
  category: "metrics",
  payloadSchema,
  resultSchema,
  defaultOptions: {
    maxAttempts: 3,
  },
  settings: {
    windowSizeSeconds: 60,
  },
};
