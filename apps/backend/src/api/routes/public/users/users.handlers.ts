import type { AppRouteHandler } from "@/utils/types";
import { userQuery } from "@/db/queries";
import type {
  ListRoute,
  GetRoute,
  CreateRoute,
  PatchRoute,
  RemoveRoute,
} from "./users.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { hashPassword } from "@/utils/password";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, search, select, ...filters } = query;
  const { data, total } = await userQuery.list({
    limit,
    offset,
    order_by,
    search,
    select,
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
  const query = c.req.valid("query");
  const { select } = query;
  const user = await userQuery.get(id, { select });
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
  const query = c.req.valid("query");
  const { password, ...rest } = input;

  const password_hash = await hashPassword(password);

  const { select } = query;
  const created = await userQuery.create(
    {
      ...rest,
      password_hash,
    },
    { select }
  );

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
  const query = c.req.valid("query");
  const input = c.req.valid("json");
  const { password, ...rest } = input;

  // If password is provided, hash it before updating
  const updateData = password
    ? { ...rest, password_hash: await hashPassword(password) }
    : rest;

  const { select } = query;
  const updated = await userQuery.update(id, updateData, { select });

  if (!updated) {
    return c.json(
      {
        data: null,
        error: { message: "User not found" },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

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
  const query = c.req.valid("query");
  const { select } = query;

  const deleted = await userQuery.delete(id, true, { select });

  if (!deleted) {
    return c.json(
      {
        data: null,
        error: { message: "User not found" },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  return c.json(
    {
      data: deleted,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
