import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  paginationWithOrderingSchema,
  responseSchema,
  createErrorSchema,
  notFoundSchema,
  createListResponses,
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
    ...createListResponses("logs", logSelectSchema, {
      customDescription: "List of logs",
    }),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Not Found",
      null,
      createErrorSchema(notFoundSchema),
      null
    ),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: responseSchema(
      "Unprocessable Entity",
      null,
      createErrorSchema(logSelectSchema),
      null
    ),
  },
});

export type ListRoute = typeof list;
