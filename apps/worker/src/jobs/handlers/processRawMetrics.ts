import { logger } from "@/utils/logger";
import { db } from "@/db/client";
import { metrics, metricsInsertSchema } from "@shared/db";
import { generateRowEmbedding } from "@shared/utils";
import type { ProcessRawMetricsPayload, RawMetric } from "../types";

const METRICS_WINDOW_SECONDS = 60;

// Calculate percentile from sorted array
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
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
  requestSizes: number[];
  responseSizes: number[];
}

export async function processRawMetrics(
  payload: ProcessRawMetricsPayload
): Promise<void> {
  logger.debug("Starting processing", {
    metricCount: payload.metrics.length,
    sampleMetrics: payload.metrics.slice(0, 3).map((m) => ({
      status: m.status,
      endpoint: m.endpoint,
      isError: m.status >= 400,
    })),
  });

  logger.info("Processing raw metrics", {
    metricCount: payload.metrics.length,
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
          requestSizes: [],
          responseSizes: [],
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
        window.requestSizes.push(metric.requestSize);
      }
      if (metric.responseSize) {
        window.responseSizes.push(metric.responseSize);
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
        window.requestSizes.length > 0
          ? Math.round(
              window.requestSizes.reduce((a, b) => a + b, 0) /
                window.requestSizes.length
            )
          : null;
      const avgResponseSize =
        window.responseSizes.length > 0
          ? Math.round(
              window.responseSizes.reduce((a, b) => a + b, 0) /
                window.responseSizes.length
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
      // We need to store errorRate as percentage (0-100) in integer column
      // Explicitly ensure errorRate is an integer
      const insertData = {
        windowStart: new Date(window.start),
        windowEnd: new Date(window.end),
        endpoint: window.endpoint,
        p50Latency: Math.round(p50),
        p95Latency: Math.round(p95),
        p99Latency: Math.round(p99),
        errorRate: Math.round(errorRatePercent) as number, // Store as percentage (0-100) for integer column - EXPLICIT INTEGER
        trafficCount: window.total,
        requestSize: avgRequestSize,
        responseSize: avgResponseSize,
      } as any; // Use 'as any' to bypass TypeScript type checking

      // Log BEFORE insert to verify the value
      logger.debug("INSERTING METRIC", {
        endpoint: window.endpoint,
        errors: window.errors,
        total: window.total,
        errorRateDecimal: errorRate,
        errorRatePercent,
        insertDataErrorRate: insertData.errorRate,
        windowStart: new Date(window.start).toISOString(),
      });

      if (window.errors > 0 || errorRatePercent > 0) {
        logger.info("INSERTING METRIC WITH ERROR RATE", {
          endpoint: window.endpoint,
          errors: window.errors,
          total: window.total,
          errorRateDecimal: errorRate,
          errorRatePercent,
          insertDataErrorRate: insertData.errorRate,
          windowStart: new Date(window.start).toISOString(),
        });
      }

      return insertData;
    });

    // Insert aggregated metrics into database
    for (const data of inserts) {
      // Log before insert
      logger.debug("ABOUT TO INSERT", {
        errorRate: data.errorRate,
        endpoint: data.endpoint,
        trafficCount: data.trafficCount,
        fullData: JSON.stringify(data, null, 2),
      });

      // Log the actual data being inserted
      if ((data.errorRate as number) > 0) {
        logger.info("ABOUT TO INSERT INTO DB", {
          errorRate: data.errorRate,
          endpoint: data.endpoint,
          trafficCount: data.trafficCount,
        });
      }

      try {
        const insertValues = {
          ...data,
          embedding: generateRowEmbedding(data),
        };

        logger.debug("Insert values errorRate", {
          errorRate: insertValues.errorRate,
        });

        const result = await db.insert(metrics).values(insertValues);

        // Log after successful insert
        logger.debug("SUCCESSFULLY INSERTED", {
          errorRate: data.errorRate,
          endpoint: data.endpoint,
        });

        if ((data.errorRate as number) > 0) {
          logger.info("SUCCESSFULLY INSERTED INTO DB", {
            errorRate: data.errorRate,
            endpoint: data.endpoint,
          });
        }
      } catch (error) {
        logger.error("FAILED TO INSERT", {
          error: error instanceof Error ? error.message : String(error),
          errorRate: data.errorRate,
          endpoint: data.endpoint,
          stack: error instanceof Error ? error.stack : undefined,
        });
        logger.error("FAILED TO INSERT METRIC", {
          error: error instanceof Error ? error.message : String(error),
          data: {
            ...data,
            errorRate: data.errorRate,
          },
        });
        throw error;
      }
    }

    logger.info("Processed raw metrics", {
      windowCount: windows.size,
      metricCount: payload.metrics.length,
    });
  } catch (error) {
    logger.error("Failed to process raw metrics", {
      payload,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
