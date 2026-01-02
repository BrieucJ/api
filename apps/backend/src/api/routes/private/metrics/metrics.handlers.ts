import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, AggregateRoute } from "./metrics.routes";
import { metrics as metricsTable } from "@/db/models/metrics";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

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
    queryBuilderFilters.window_start__gte = startDate;
  }
  if (endDate) {
    queryBuilderFilters.window_end__lte = endDate;
  }

  const { data, total } = await metricsQuery.list({
    limit,
    offset,
    order_by,
    order,
    search,
    filters: queryBuilderFilters,
  });

  // Convert error_rate from percentage (0-100) back to decimal (0-1) for API
  const convertedData = data.map((metric) => {
    const errorRateValue = metric.error_rate ?? 0;
    const convertedErrorRate =
      typeof errorRateValue === "number" && !isNaN(errorRateValue)
        ? errorRateValue / 100
        : 0; // Convert from percentage to decimal, handle edge cases

    return {
      ...metric,
      error_rate: convertedErrorRate,
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

export const aggregate: AppRouteHandler<AggregateRoute> = async (c) => {
  const query = c.req.valid("query");
  const { endpoint, startDate, endDate, windowSize } = query;

  // Convert route-specific filters to querybuilder filter format
  const queryBuilderFilters: Record<string, any> = {};
  if (endpoint) {
    queryBuilderFilters.endpoint__eq = endpoint;
  }
  if (startDate) {
    queryBuilderFilters.window_start__gte = startDate;
  }
  if (endDate) {
    queryBuilderFilters.window_end__lte = endDate;
  }

  const { data: results } = await metricsQuery.list({
    filters: queryBuilderFilters,
    limit: 10000, // Large limit for aggregation
    order_by: "window_start",
    order: "asc",
  });

  // Convert error_rate from percentage (0-100) back to decimal (0-1) for API
  const convertedResults = results.map((metric) => ({
    ...metric,
    error_rate: (metric.error_rate ?? 0) / 100, // Convert from percentage to decimal
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
