import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
} from "@/utils/helpers";
import { logSelectSchema } from "@/db/models/logs";

const tags = ["Logs"];
const basePath = "logs";

export const list = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {
    query: paginationWithOrderingSchema(logSelectSchema),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List of logs",
      z.array(logSelectSchema), // data schema
      null, // no error
      paginationSchema // pagination metadata
    ),
  },
});

export type ListRoute = typeof list;
