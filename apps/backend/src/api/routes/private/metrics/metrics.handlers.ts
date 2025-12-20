import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, StreamRoute, AggregateRoute } from "./metrics.routes";
import { metrics as metricsTable } from "@/db/models/metrics";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { streamSSE } from "hono/streaming";
import { db } from "@/db/client";
import { metrics } from "@/db/models/metrics";
import { gt, desc, eq, gte, lte, and } from "drizzle-orm";

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

  return c.json(
    {
      data,
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
    // Send last X metrics
    const initialMetrics = await db
      .select()
      .from(metrics)
      .orderBy(desc(metrics.id))
      .limit(INITIAL_METRICS_COUNT);

    for (const metric of initialMetrics.reverse()) {
      await stream.writeSSE({
        data: JSON.stringify(metric),
        event: "metric-update",
      });
    }

    let lastId = (initialMetrics[initialMetrics.length - 1] ?? {}).id ?? 0;

    // Stream new metrics continuously
    while (true) {
      const newMetrics = await db
        .select()
        .from(metrics)
        .where(gt(metrics.id, lastId));

      for (const metric of newMetrics) {
        await stream.writeSSE({
          data: JSON.stringify(metric),
          event: "metric-update",
        });
        lastId = Math.max(lastId, metric.id);
      }

      await stream.sleep(1000);
    }
  });
};

export const aggregate: AppRouteHandler<AggregateRoute> = async (c) => {
  const query = c.req.valid("query");
  const { endpoint, startDate, endDate, windowSize } = query;

  const conditions: any[] = [];
  if (endpoint) {
    conditions.push(eq(metrics.endpoint, endpoint));
  }
  if (startDate) {
    conditions.push(gte(metrics.windowStart, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(metrics.windowEnd, new Date(endDate)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select()
    .from(metrics)
    .where(whereClause)
    .orderBy(metrics.windowStart);

  // Group by time windows if needed (for now, return as-is since we already aggregate in middleware)
  // In the future, we could do additional aggregation here

  return c.json(
    {
      data: results,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
