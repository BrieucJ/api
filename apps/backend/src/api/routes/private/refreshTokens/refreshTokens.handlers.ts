import type { AppRouteHandler } from "@/utils/types";
import { refreshTokenQuery } from "@/db/queries";
import type { ListRoute, GetRoute, RemoveRoute } from "./refreshTokens.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const { limit, offset, order_by, search, select, ...filters } = query;
  const { data, total } = await refreshTokenQuery.list({
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
  const token = await refreshTokenQuery.get(id);

  if (!token) {
    return c.json(
      {
        data: null,
        error: {
          message: "Refresh token not found",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  return c.json(
    {
      data: token,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const token = await refreshTokenQuery.get(id);

  if (!token) {
    return c.json(
      {
        data: null,
        error: {
          message: "Refresh token not found",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  await refreshTokenQuery.delete(id, false); // Hard delete for refresh tokens

  return c.json(
    {
      data: { id },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
