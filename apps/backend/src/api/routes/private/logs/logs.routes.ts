import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import {
  paginationWithOrderingSchema,
  paginationSchema,
  responseSchema,
} from "@/utils/helpers";
import { logSelectSchema } from "@/db/models/logs";
import { users as usersTable } from "@/db/models/users";
import { createQueryBuilder } from "@/db/querybuilder";
import { streamSSE } from "hono/streaming";
import { db } from "@/db/client";
import { logs } from "@/db/models/logs";
import { gt, desc } from "drizzle-orm";

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

export const stream = createRoute({
  tags,
  method: "get",
  path: `${basePath}/stream`,
  hide: true,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: {
      description: "Stream logs",
      content: {
        "text/event-stream": { schema: logSelectSchema },
      },
    },
  },
});

export type ListRoute = typeof list;
export type StreamRoute = typeof stream;
