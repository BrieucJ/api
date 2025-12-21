import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, StreamRoute, AggregateRoute } from "./metrics.routes";
import { metrics as metricsTable } from "@/db/models/metrics";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { streamSSE } from "hono/streaming";
import { logger } from "@/utils/logger";

const metricsQuery = createQueryBuilder<typeof metricsTable>(metricsTable);

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const {
    limit,
    offset,
    order_by,
    order,
    search,
    endpoint,
    startDate,
    endDate,
    ...filters
  } = query;

  // Convert route-specific filters to querybuilder filter format
  const queryBuilderFilters: Record<string, any> = { ...filters };

  if (endpoint) {
    queryBuilderFilters.endpoint__eq = endpoint;
  }
  if (startDate) {
    queryBuilderFilters.windowStart__gte = startDate;
  }
  if (endDate) {
    queryBuilderFilters.windowEnd__lte = endDate;
  }

  const { data, total } = await metricsQuery.list({
    limit,
    offset,
    order_by,
    order,
    search,
    filters: queryBuilderFilters,
  });

  // Convert errorRate from percentage (0-100) back to decimal (0-1) for API
  const convertedData = data.map((metric) => {
    const errorRateValue = metric.errorRate ?? 0;
    const convertedErrorRate =
      typeof errorRateValue === "number" && !isNaN(errorRateValue)
        ? errorRateValue / 100
        : 0; // Convert from percentage to decimal, handle edge cases

    return {
      ...metric,
      errorRate: convertedErrorRate,
    };
  });

  return c.json(
    {
      data: convertedData,
      error: null,
      metadata: {
        limit,
        offset,
        total,
      },
    },
    HTTP_STATUS_CODES.OK
  );
};

export const stream: AppRouteHandler<StreamRoute> = async (c) => {
  const INITIAL_METRICS_COUNT = 50;
  return streamSSE(c, async (stream) => {
    // Send last X metrics (newest first)
    const { data: initialMetrics } = await metricsQuery.list({
      limit: INITIAL_METRICS_COUNT,
      offset: 0,
      order_by: "id",
      order: "desc",
    });

    // Send them newest first (no reverse needed)
    // Convert errorRate from percentage (0-100) back to decimal (0-1) for API
    for (const metric of initialMetrics) {
      try {
        const errorRateValue = metric.errorRate ?? 0;
        const convertedErrorRate =
          typeof errorRateValue === "number" && !isNaN(errorRateValue)
            ? errorRateValue / 100
            : 0; // Convert from percentage to decimal

        const convertedMetric = {
          ...metric,
          errorRate: convertedErrorRate,
        };
        await stream.writeSSE({
          data: JSON.stringify(convertedMetric),
          event: "metric-update",
        });
      } catch (error) {
        logger.error("Error processing initial metric", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue with next metric
      }
    }

    // Keep track of the last metric ID (highest ID seen so far)
    let lastId = (initialMetrics[0] ?? {}).id ?? 0;

    // Stream new metrics continuously
    while (true) {
      const { data: newMetrics } = await metricsQuery.list({
        filters: { id__gt: lastId },
        limit: 1000, // Large limit to get all new metrics
        order_by: "id",
        order: "asc",
      });

      for (const metric of newMetrics) {
        try {
          // Convert errorRate from percentage (0-100) back to decimal (0-1) for API
          const errorRateValue = metric.errorRate ?? 0;
          const convertedErrorRate =
            typeof errorRateValue === "number" && !isNaN(errorRateValue)
              ? errorRateValue / 100
              : 0; // Convert from percentage to decimal

          const convertedMetric = {
            ...metric,
            errorRate: convertedErrorRate,
          };
          await stream.writeSSE({
            data: JSON.stringify(convertedMetric),
            event: "metric-update",
          });
          lastId = Math.max(lastId, metric.id);
        } catch (error) {
          logger.error("Error processing new metric", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          // Continue with next metric
        }
      }

      await stream.sleep(1000);
    }
  });
};

export const aggregate: AppRouteHandler<AggregateRoute> = async (c) => {
  const query = c.req.valid("query");
  const { endpoint, startDate, endDate, windowSize } = query;

  // Convert route-specific filters to querybuilder filter format
  const queryBuilderFilters: Record<string, any> = {};
  if (endpoint) {
    queryBuilderFilters.endpoint__eq = endpoint;
  }
  if (startDate) {
    queryBuilderFilters.windowStart__gte = startDate;
  }
  if (endDate) {
    queryBuilderFilters.windowEnd__lte = endDate;
  }

  const { data: results } = await metricsQuery.list({
    filters: queryBuilderFilters,
    limit: 10000, // Large limit for aggregation
    order_by: "windowStart",
    order: "asc",
  });

  // Convert errorRate from percentage (0-100) back to decimal (0-1) for API
  const convertedResults = results.map((metric) => ({
    ...metric,
    errorRate: (metric.errorRate ?? 0) / 100, // Convert from percentage to decimal
  }));

  // Group by time windows if needed (for now, return as-is since we already aggregate in middleware)
  // In the future, we could do additional aggregation here

  return c.json(
    {
      data: convertedResults,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
