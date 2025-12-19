import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Info"];
const basePath = "info";

export const infoResponseSchema = z.object({
  name: z.string().openapi({ example: "api" }),
  version: z.string().openapi({ example: "0.0.1" }),
  environment: z.string().openapi({ example: "development" }),
  timestamp: z
    .string()
    .datetime()
    .openapi({ example: "2024-01-01T00:00:00.000Z" }),
  uptime: z.object({
    milliseconds: z.number().openapi({ example: 3600000 }),
    seconds: z.number().openapi({ example: 3600 }),
    minutes: z.number().openapi({ example: 60 }),
    hours: z.number().openapi({ example: 1 }),
    days: z.number().openapi({ example: 0 }),
    formatted: z.string().openapi({ example: "0d 1h 0m 0s" }),
  }),
  apiBasePath: z.string().openapi({ example: "/api/v1" }),
  database: z.object({
    connected: z.boolean(),
  }),
});

export const get = createRoute({
  tags,
  method: "get",
  path: basePath,
  hide: true,
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "API information",
      infoResponseSchema
    ),
  },
});

export type GetRoute = typeof get;
