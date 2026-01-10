import { createRoute, z } from "@hono/zod-openapi";
import {
  jsonContentRequired,
  idParamSchema,
  paginationWithOrderingSchema,
  selectFieldSchema,
  createListResponses,
  createGetResponses,
  createCreateResponses,
  createUpdateResponses,
  createDeleteResponses,
} from "@/utils/helpers";
import {
  userInsertSchema,
  userUpdateSchema,
  userSelectSchema,
} from "@/db/models/users";

const tags = ["Users"];
const basePath = "users";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  request: {
    query: paginationWithOrderingSchema(userSelectSchema),
  },
  responses: createListResponses("users", userSelectSchema),
});

export const get = createRoute({
  tags,
  method: "get",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
    ...selectFieldSchema(userSelectSchema),
  },
  responses: createGetResponses("user", userSelectSchema),
});

export const create = createRoute({
  path: basePath,
  method: "post",
  request: {
    body: jsonContentRequired(userInsertSchema, "The user to create"),
    ...selectFieldSchema(userSelectSchema),
  },
  tags,
  responses: createCreateResponses("user", userSelectSchema, userInsertSchema),
});

export const put = createRoute({
  tags,
  method: "put",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
    ...selectFieldSchema(userSelectSchema),
    body: jsonContentRequired(userUpdateSchema, "The user data to update"),
  },
  responses: createUpdateResponses("user", userSelectSchema, userUpdateSchema),
});

export const remove = createRoute({
  tags,
  method: "delete",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
    ...selectFieldSchema(userSelectSchema),
  },
  responses: createDeleteResponses("user", userSelectSchema),
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetRoute = typeof get;
export type PutRoute = typeof put;
export type RemoveRoute = typeof remove;
