import type { AppRouteHandler } from "@/utils/types";
import type { GetStatsRoute } from "./worker.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { workerStatsQuery } from "@/db/queries";

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
  // Get the most recent worker stats
  const limit = 1;
  const offset = 0;
  const { data, total } = await workerStatsQuery.list({
    limit,
    offset,
    order_by: { field: "last_heartbeat", order: "desc" },
  });

  return c.json(
    {
      data,
      error: null,
      metadata: { limit, offset, total },
    },
    HTTP_STATUS_CODES.OK
  );
};
