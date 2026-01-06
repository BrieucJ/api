import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema } from "@/utils/helpers";

const tags = ["Admin"];

const modelSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  pluralName: z.string(),
  basePath: z.string(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const fieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  readonly: z.boolean().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .optional(),
});

const schemaResponseSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  fields: z.array(fieldSchema),
});

export const listModels = createRoute({
  tags,
  method: "get",
  path: "admin/models",
  hide: true,
  summary: "List all available models",
  description:
    "Returns a list of all database models available for admin interface",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "List of available models",
      z.array(modelSchema)
    ),
  },
});

export const getSchema = createRoute({
  tags,
  method: "get",
  path: "admin/schema/{modelName}",
  hide: true,
  summary: "Get schema for a model",
  description:
    "Returns the schema information for a specific model including all fields and their types",
  request: {
    params: z.object({
      modelName: z.string().openapi({
        param: {
          name: "modelName",
          in: "path",
        },
        example: "users",
      }),
    }),
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Schema information for the model",
      schemaResponseSchema
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "Model not found",
      z.object({ message: z.string() })
    ),
  },
});

export type ListModelsRoute = typeof listModels;
export type GetSchemaRoute = typeof getSchema;
