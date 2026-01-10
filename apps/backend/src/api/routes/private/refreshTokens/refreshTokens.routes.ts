import { createRoute, z } from "@hono/zod-openapi";
import {
  idParamSchema,
  paginationWithOrderingSchema,
  createListResponses,
  createGetResponses,
  createDeleteResponses,
} from "@/utils/helpers";
import { refreshTokenSelectSchema } from "@/db/models/refreshTokens";

const tags = ["RefreshTokens"];
const basePath = "refresh_tokens";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {
    query: paginationWithOrderingSchema(refreshTokenSelectSchema),
  },
  responses: createListResponses("refresh_tokens", refreshTokenSelectSchema),
});

export const get = createRoute({
  tags,
  method: "get",
  path: `${basePath}/{id}`,
  hide: true,
  request: {
    params: idParamSchema,
  },
  responses: createGetResponses("refresh token", refreshTokenSelectSchema),
});

export const remove = createRoute({
  tags,
  method: "delete",
  path: `${basePath}/{id}`,
  hide: true,
  request: {
    params: idParamSchema,
  },
  responses: createDeleteResponses("refresh token", refreshTokenSelectSchema),
});

export type ListRoute = typeof list;
export type GetRoute = typeof get;
export type RemoveRoute = typeof remove;
