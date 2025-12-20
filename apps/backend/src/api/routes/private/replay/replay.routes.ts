import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
  idParamSchema,
} from "@/utils/helpers";
import { snapshotSelectSchema } from "@/db/models/requestSnapshots";

const tags = ["Replay"];
const basePath = "replay";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {
    query: paginationWithOrderingSchema(snapshotSelectSchema).extend({
      method: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "method",
            in: "query",
          },
          example: "POST",
        }),
      path: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "path",
            in: "query",
          },
          example: "/api/v1/users",
        }),
      statusCode: z.coerce
        .number()
        .int()
        .optional()
        .openapi({
          param: {
            name: "statusCode",
            in: "query",
          },
          example: 200,
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
      "List of request snapshots",
      z.array(snapshotSelectSchema),
      null,
      paginationSchema
    ),
  },
});

export const get = createRoute({
  tags,
  method: "get",
  path: `${basePath}/{id}`,
  hide: true,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Request snapshot details",
      snapshotSelectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Snapshot not found",
      null,
      z.object({ message: z.string() }),
      null
    ),
  },
});

export const replay = createRoute({
  tags,
  method: "post",
  path: `${basePath}/{id}/replay`,
  hide: true,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Replay result",
      z.object({
        statusCode: z.number().int(),
        headers: z.record(z.string(), z.string()),
        body: z.any(),
        duration: z.number().int(),
      }),
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Snapshot not found",
      null,
      z.object({ message: z.string() }),
      null
    ),
    [HTTP_STATUS_CODES.FORBIDDEN]: responseSchema(
      "Replay not allowed",
      null,
      z.object({ message: z.string() }),
      null
    ),
    [HTTP_STATUS_CODES.BAD_REQUEST]: responseSchema(
      "Bad request",
      null,
      z.object({ message: z.string() }),
      null
    ),
    [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: responseSchema(
      "Replay failed",
      null,
      z.object({ message: z.string() }),
      null
    ),
  },
});

export type ListRoute = typeof list;
export type GetRoute = typeof get;
export type ReplayRoute = typeof replay;
