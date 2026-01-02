import type { AppRouteHandler } from "@/utils/types";
import type { GetStatsRoute } from "./worker.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createQueryBuilder } from "@/db/querybuilder";
import { workerStats as workerStatsTable } from "@/db/models/workerStats";

const statsQuery =
  createQueryBuilder<typeof workerStatsTable>(workerStatsTable);

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
  // Get the most recent worker stats
  const limit = 1;
  const offset = 0;
  const { data, total } = await statsQuery.list({
    limit,
    offset,
    order_by: "last_heartbeat",
    order: "desc",
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
