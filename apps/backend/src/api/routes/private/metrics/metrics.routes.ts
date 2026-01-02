import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
} from "@/utils/helpers";
import { metricsSelectSchema } from "@/db/models/metrics";

const tags = ["Metrics"];
const basePath = "metrics";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {
    query: paginationWithOrderingSchema(metricsSelectSchema).extend({
      endpoint: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "endpoint",
            in: "query",
          },
          example: "/api/v1/users",
        }),
      startDate: z
        .string()
        .datetime()
        .optional()
        .openapi({
          param: {
            name: "startDate",
            in: "query",
          },
          example: "2024-01-01T00:00:00Z",
        }),
      endDate: z
        .string()
        .datetime()
        .optional()
        .openapi({
          param: {
            name: "endDate",
            in: "query",
          },
          example: "2024-01-31T23:59:59Z",
        }),
    }),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List of metrics",
      z.array(metricsSelectSchema),
      null,
      paginationSchema
    ),
  },
});

export const aggregate = createRoute({
  tags,
  method: "get",
  path: `${basePath}/aggregate`,
  hide: true,
  request: {
    query: z.object({
      endpoint: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "endpoint",
            in: "query",
          },
          example: "/api/v1/users",
        }),
      startDate: z
        .string()
        .datetime()
        .openapi({
          param: {
            name: "startDate",
            in: "query",
          },
          example: "2024-01-01T00:00:00Z",
        }),
      endDate: z
        .string()
        .datetime()
        .openapi({
          param: {
            name: "endDate",
            in: "query",
          },
          example: "2024-01-31T23:59:59Z",
        }),
      windowSize: z.coerce
        .number()
        .int()
        .min(60)
        .max(3600)
        .default(60)
        .openapi({
          param: {
            name: "windowSize",
            in: "query",
          },
          example: 60,
          description: "Window size in seconds (60-3600)",
        }),
    }),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Aggregated metrics",
      z.array(metricsSelectSchema),
      null,
      null
    ),
  },
});

export type ListRoute = typeof list;
export type AggregateRoute = typeof aggregate;
