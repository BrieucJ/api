import { createRoute } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createErrorSchema, responseSchema } from "@/utils/helpers";
import { workerStatsSelectSchema } from "@/db/models/workerStats";

const tags = ["Worker"];
const basePath = "worker";

export const getStats = createRoute({
  tags,
  method: "get",
  path: `${basePath}/stats`,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Worker statistics from database",
      workerStatsSelectSchema
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Not found",
      createErrorSchema(workerStatsSelectSchema),
      null,
      null
    ),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: responseSchema(
      "Validation error",
      createErrorSchema(workerStatsSelectSchema),
      null,
      null
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Worker unavailable",
      createErrorSchema(workerStatsSelectSchema),
      null,
      null
    ),
  },
});

export type GetStatsRoute = typeof getStats;
