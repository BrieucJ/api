import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type {
  ListRoute,
  GetRoute,
  CreateRoute,
  PatchRoute,
  RemoveRoute,
} from "./users.routes";
import { users as usersTable } from "@/db/models/users";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

const userQuery = createQueryBuilder<typeof usersTable>(usersTable);

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, order, search, ...filters } = query;
  const { data, total } = await userQuery.list({
    limit,
    offset,
    order_by,
    order,
    search,
    filters,
  });

  return c.json(
    {
      data,
      error: null,
      metadata: {
        limit,
        offset,
        total,
      },
    },
    HTTP_STATUS_CODES.OK
  );
};

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const user = await userQuery.get(id);
  return c.json(
    {
      data: user,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const input = c.req.valid("json");
  const created = await userQuery.create(input);

  return c.json(
    {
      data: created,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.CREATED
  );
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await userQuery.update(id, input);

  return c.json(
    {
      data: updated,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await userQuery.delete(id);

  return c.json(
    {
      data: { id },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
