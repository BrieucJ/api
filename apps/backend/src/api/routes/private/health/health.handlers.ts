import type { AppRouteHandler } from "@/utils/types";
import type { GetRoute } from "./health.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

export const get: AppRouteHandler<GetRoute> = async (c) => {
  // Simple health check - can be extended to check dependencies
  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
  };

  return c.json(
    {
      data: health,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
