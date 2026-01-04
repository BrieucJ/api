import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  idParamSchema,
  notFoundSchema,
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
} from "@/utils/helpers";
import { refreshTokenSelectSchema } from "@/db/models/refreshTokens";

const tags = ["RefreshTokens"];
const basePath = "refresh_tokens";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  request: {
    query: paginationWithOrderingSchema(refreshTokenSelectSchema),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List refresh tokens",
      z.array(refreshTokenSelectSchema),
      null,
      paginationSchema
    ),
  },
});

export const get = createRoute({
  tags,
  method: "get",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Get refresh token by ID",
      refreshTokenSelectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Refresh token not found",
      null,
      notFoundSchema,
      null
    ),
  },
});

export const remove = createRoute({
  tags,
  method: "delete",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Refresh token deleted",
      refreshTokenSelectSchema.pick({ id: true }),
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Refresh token not found",
      null,
      notFoundSchema,
      null
    ),
  },
});

export type ListRoute = typeof list;
export type GetRoute = typeof get;
export type RemoveRoute = typeof remove;
