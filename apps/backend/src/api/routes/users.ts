import {
  users as usersTable,
  userSelectSchema,
  userInsertSchema,
  userUpdateSchema,
} from "../../db/models/users";
import { createRoute } from "@hono/zod-openapi";
import {
  jsonContent,
  requestBody,
  createErrorSchema,
  paginationWithOrderingSchema,
  paginatedResponseSchema,
  idParamSchema,
} from "@/utils/helpers";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { createQueryBuilder } from "@/db/querybuilder";
import { createRouter } from "@/utils/helpers";

const router = createRouter();
const userQuery = createQueryBuilder<typeof usersTable>(usersTable);

const tags = ["Users"];
const basePath = "/users";

//
// ──────────────────────────────────────────────────────────
// GET /users
// ──────────────────────────────────────────────────────────
//

const listUsersRoute = createRoute({
  tags,
  method: "get",
  path: basePath,
  request: {
    query: paginationWithOrderingSchema(userSelectSchema),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: jsonContent(
      paginatedResponseSchema(userSelectSchema),
      "List users"
    ),
  },
});

router.openapi(listUsersRoute, async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, order, search, ...filters } = query;
  const { data, total } = await userQuery.list({
    limit: query.limit,
    offset: query.offset,
    order_by: query.order_by,
    order: query.order,
    search: query.search,
    filters: filters,
  });

  return c.json(
    {
      data,
      meta: {
        limit: query.limit,
        offset: query.offset,
        total,
      },
    },
    HTTP_STATUS_CODES.OK
  );
});

//
// ──────────────────────────────────────────────────────────
// GET /users/:id
// ──────────────────────────────────────────────────────────
//

const getUserRoute = createRoute({
  tags,
  method: "get",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: jsonContent(userSelectSchema, "Get user by ID"),
    [HTTP_STATUS_CODES.NOT_FOUND]: {
      description: "User not found",
    },
  },
});

router.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid("param");
  const user = await userQuery.get(id);

  if (!user) {
    return c.json({ message: "User not found" }, HTTP_STATUS_CODES.NOT_FOUND);
  }

  // schema expects user fields directly
  return c.json(user, HTTP_STATUS_CODES.OK);
});

//
// ──────────────────────────────────────────────────────────
// POST /users
// ──────────────────────────────────────────────────────────
//

const createUserRoute = createRoute({
  tags,
  method: "post",
  path: basePath,
  request: requestBody(userInsertSchema),
  responses: {
    [HTTP_STATUS_CODES.CREATED]: jsonContent(userSelectSchema, "User created"),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(userInsertSchema),
      "Validation errors"
    ),
  },
});

router.openapi(createUserRoute, async (c) => {
  const input = c.req.valid("json");
  const created = await userQuery.create(input);

  return c.json(created, HTTP_STATUS_CODES.CREATED);
});

//
// ──────────────────────────────────────────────────────────
// PUT /users/:id
// ──────────────────────────────────────────────────────────
//

const updateUserRoute = createRoute({
  tags,
  method: "put",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
    ...requestBody(userUpdateSchema),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: jsonContent(userSelectSchema, "User updated"),
    [HTTP_STATUS_CODES.NOT_FOUND]: {
      description: "User not found",
    },
  },
});

router.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");

  const updated = await userQuery.update(id, input);

  if (!updated) {
    return c.json({ message: "User not found" }, HTTP_STATUS_CODES.NOT_FOUND);
  }

  return c.json(updated, HTTP_STATUS_CODES.OK);
});

//
// ──────────────────────────────────────────────────────────
// DELETE /users/:id
// ──────────────────────────────────────────────────────────
//

const deleteUserRoute = createRoute({
  tags,
  method: "delete",
  path: `${basePath}/{id}`,
  request: {
    params: idParamSchema,
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: jsonContent(
      userSelectSchema.pick({ id: true }),
      "User deleted"
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: {
      description: "User not found",
    },
  },
});

router.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await userQuery.delete(id);

  if (!deleted) {
    return c.json({ message: "User not found" }, HTTP_STATUS_CODES.NOT_FOUND);
  }

  return c.json({ id }, HTTP_STATUS_CODES.OK);
});

export default router;
