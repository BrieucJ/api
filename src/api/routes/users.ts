import {
  users as usersTable,
  userSelectSchema,
  userInsertSchema,
  userUpdateSchema,
} from "../../db/models/users";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  jsonContent,
  requestBody,
  createErrorSchema,
  paginationWithOrderingSchema,
  paginatedResponseSchema,
  idParamSchema,
} from "@/utils/helpers";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { defaultHook } from "@/utils/helpers";
import { createQueryBuilder } from "@/db/querybuilder";
import { z } from "zod";

const user = new OpenAPIHono({
  defaultHook,
});

const tags = ["Users"];

export const userQuery = createQueryBuilder<typeof usersTable>(usersTable);
//List users
user.openapi(
  {
    tags,
    method: "get",
    path: "/",
    request: {
      query: paginationWithOrderingSchema(userSelectSchema),
    },
    responses: {
      [HTTP_STATUS_CODES.OK]: jsonContent(
        paginatedResponseSchema(userSelectSchema),
        "List users"
      ),
    },
  },
  async (c) => {
    const query = paginationWithOrderingSchema(userSelectSchema).parse(
      c.req.query()
    );
    const { limit, offset, order_by, order, search, ...filters } = query;

    const { data, total } = await userQuery.list({
      limit: query.limit,
      offset: query.offset,
      order_by: query.order_by,
      order: query.order,
      search: query.search,
      filters: filters,
    });

    return c.json({
      data,
      meta: { limit: query.limit, offset: query.offset, total },
    });
  }
);

// Get user by ID
user.openapi(
  {
    tags,
    method: "get",
    path: "/:id",
    request: {
      params: idParamSchema,
    },
    responses: {
      [HTTP_STATUS_CODES.OK]: jsonContent(userSelectSchema, "Get user by ID"),
      [HTTP_STATUS_CODES.NOT_FOUND]: { description: "User not found" },
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const user = await userQuery.get(id);
    return user ? c.json(user) : c.text("User not found", 404);
  }
);

// Create user
user.openapi(
  {
    tags,
    method: "post",
    path: "/",
    request: requestBody(userInsertSchema),
    responses: {
      [HTTP_STATUS_CODES.CREATED]: jsonContent(
        userSelectSchema,
        "User created"
      ),
      [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: jsonContent(
        createErrorSchema(userInsertSchema),
        "Validation errors"
      ),
    },
  },
  async (c) => {
    const parsed = c.req.valid("json");
    const created = await userQuery.create(parsed);
    return c.json(created, HTTP_STATUS_CODES.CREATED);
  }
);

// Update user
user.openapi(
  {
    tags,
    method: "put",
    path: "/:id",
    request: {
      params: idParamSchema,
      ...requestBody(userUpdateSchema),
    },
    responses: {
      [HTTP_STATUS_CODES.OK]: jsonContent(userSelectSchema, "User updated"),
      [HTTP_STATUS_CODES.NOT_FOUND]: { description: "User not found" },
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const parsed = c.req.valid("json");
    const updated = await userQuery.update(id, parsed);
    return updated
      ? c.json(updated)
      : c.text("User not found", HTTP_STATUS_CODES.NOT_FOUND);
  }
);

// Delete user
user.openapi(
  {
    tags,
    method: "delete",
    path: "/:id",
    request: {
      params: idParamSchema,
    },
    responses: {
      [HTTP_STATUS_CODES.OK]: jsonContent(
        userSelectSchema.pick({ id: true }),
        "User deleted"
      ),
      [HTTP_STATUS_CODES.NOT_FOUND]: { description: "User not found" },
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await userQuery.delete(id);
    return deleted
      ? c.json({ id })
      : c.text("User not found", HTTP_STATUS_CODES.NOT_FOUND);
  }
);

export default user;
