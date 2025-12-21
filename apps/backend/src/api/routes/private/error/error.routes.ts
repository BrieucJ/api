import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createErrorSchema, responseSchema } from "@/utils/helpers";

const tags = ["Error"];
const basePath = "error";

export const error = createRoute({
  tags,
  method: "get",
  path: basePath,
  request: {
    query: z.object({
      errorRate: z.coerce
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .openapi({
          param: {
            name: "errorRate",
            in: "query",
          },
          example: 0.5,
          description: "Probability of returning an error (0-1)",
        }),
    }),
  },
  responses: {
    [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: responseSchema(
      "Error response",
      null,
      z.object({
        message: z.string(),
        code: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.BAD_GATEWAY]: responseSchema(
      "Bad Gateway error response",
      null,
      z.object({
        message: z.string(),
        code: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.SERVICE_UNAVAILABLE]: responseSchema(
      "Service Unavailable error response",
      null,
      z.object({
        message: z.string(),
        code: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.GATEWAY_TIMEOUT]: responseSchema(
      "Gateway Timeout error response",
      null,
      z.object({
        message: z.string(),
        code: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Success response",
      z.object({ success: z.boolean() }),
      null,
      null
    ),
  },
});

export type ErrorRoute = typeof error;
