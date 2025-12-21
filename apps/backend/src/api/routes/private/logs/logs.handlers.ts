import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, StreamRoute } from "./logs.routes";
import { stream as streamRoute } from "./logs.routes";
import { logs as logsTable } from "@/db/models/logs";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { streamSSE } from "hono/streaming";
import type { TypedResponse } from "hono";
import { logger } from "@/utils/logger";

const logQuery = createQueryBuilder<typeof logsTable>(logsTable);

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, order, search, ...filters } = query;
  const { data, total } = await logQuery.list({
    limit,
    offset,
    order_by,
    order,
    search,
    filters,
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
  const INITIAL_LOG_COUNT = 50;
  return streamSSE(c, async (stream) => {
    // Send last X logs (newest first)
    const { data: initialLogs, total } = await logQuery.list({
      limit: INITIAL_LOG_COUNT,
      offset: 0,
      order_by: "id",
      order: "desc",
    });

    // Send them newest first (no reverse needed)
    for (const log of initialLogs) {
      await stream.writeSSE({
        data: JSON.stringify(log),
        event: "log-update",
      });
    }

    // Keep track of the last log ID (highest ID seen so far)
    let lastId = (initialLogs[0] ?? {}).id ?? 0;

    // Stream new logs continuously
    while (true) {
      const { data: newLogs } = await logQuery.list({
        filters: { id__gt: lastId },
        limit: 1000, // Large limit to get all new logs
        order_by: "id",
        order: "asc",
      });

      for (const log of newLogs) {
        await stream.writeSSE({
          data: JSON.stringify(log),
          event: "log-update",
        });
        lastId = Math.max(lastId, log.id);
      }

      await stream.sleep(1000);
    }
  });
};
