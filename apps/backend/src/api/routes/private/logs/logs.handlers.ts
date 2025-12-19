import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, StreamRoute } from "./logs.routes";
import { stream as streamRoute } from "./logs.routes";
import { logs as logsTable } from "@/db/models/logs";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { streamSSE } from "hono/streaming";
import { db } from "@/db/client";
import { logs } from "@/db/models/logs";
import { gt, desc } from "drizzle-orm";
import type { TypedResponse } from "hono";

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
    // Send last X logs
    const initialLogs = await db
      .select()
      .from(logs)
      .orderBy(desc(logs.id))
      .limit(INITIAL_LOG_COUNT);

    for (const log of initialLogs.reverse()) {
      await stream.writeSSE({
        data: JSON.stringify(log),
        event: "log-update",
      });
    }

    let lastId = (initialLogs[initialLogs.length - 1] ?? {}).id ?? 0;

    // Stream new logs continuously
    while (true) {
      const newLogs = await db.select().from(logs).where(gt(logs.id, lastId));

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
