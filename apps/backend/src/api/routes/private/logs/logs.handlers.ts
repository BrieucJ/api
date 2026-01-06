import type { AppRouteHandler } from "@/utils/types";
import { logQuery } from "@/db/queries";
import type { ListRoute } from "./logs.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, search, select, ...filters } = query;
  const { data, total } = await logQuery.list({
    limit,
    offset,
    order_by,
    search,
    select,
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
