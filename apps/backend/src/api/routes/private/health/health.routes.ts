import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Health"];
const basePath = "health";

export const healthResponseSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]).openapi({ example: "healthy" }),
  timestamp: z
    .string()
    .datetime()
    .openapi({ example: "2024-01-01T00:00:00.000Z" }),
});

export const get = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Health check status",
      healthResponseSchema
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Service unavailable",
      healthResponseSchema
    ),
  },
});

export type GetRoute = typeof get;
