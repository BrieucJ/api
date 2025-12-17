import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  jsonContentRequired,
  createErrorSchema,
  idParamSchema,
  requestBody,
  notFoundSchema,
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
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
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List users",
      z.array(userSelectSchema), // data schema
      null, // no error
      paginationSchema // pagination metadata
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
      "Get user by ID",
      userSelectSchema, // data schema
      null, // no error
      null // no metadata
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "User not found",
      null, // no data
      notFoundSchema,
      null // no metadata
    ),
  },
});

export const create = createRoute({
  path: basePath,
  method: "post",
  request: {
    body: jsonContentRequired(userInsertSchema, "The user to create"),
  },
  tags,
  responses: {
    [HTTP_STATUS_CODES.CREATED]: responseSchema(
      "The created user",
      userSelectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: responseSchema(
      "Validation errors",
      null,
      createErrorSchema(userInsertSchema),
      null
    ),
  },
});

export const patch = createRoute({
  tags,
  method: "patch",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
    ...requestBody(userUpdateSchema),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "User updated",
      userSelectSchema, // data schema
      null, // no error
      null // no metadata
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "User not found",
      null, // no data
      notFoundSchema,
      null // no metadata
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
      "User deleted",
      userSelectSchema.pick({ id: true }), // data schema
      null, // no error
      null // no metadata
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "User not found",
      null, // no data
      notFoundSchema,
      null // no metadata
    ),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetRoute = typeof get;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
