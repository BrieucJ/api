import type { AppRouteHandler } from "@/utils/types";
import type { GetStatsRoute } from "./worker.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createQueryBuilder } from "@/db/querybuilder";
import { workerStats as workerStatsTable } from "@/db/models/workerStats";

const statsQuery =
  createQueryBuilder<typeof workerStatsTable>(workerStatsTable);

export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
  // Worker stats always uses ID 1
  const stats = await statsQuery.get(1);

  return c.json(
    {
      data: stats,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
