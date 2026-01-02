import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute } from "./logs.routes";
import { logs as logsTable } from "@/db/models/logs";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

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
