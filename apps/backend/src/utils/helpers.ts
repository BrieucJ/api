import { type z as zodType, z } from "@hono/zod-openapi";
import type { Hook } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { LOOKUP_MAP } from "@/db/querybuilder";

type ZodSchema =
  | zodType.ZodUnion
  | zodType.ZodObject
  | zodType.ZodArray<z.ZodObject>;
type ZodIssue = z.core.$ZodIssue;

export const jsonContent = <T extends ZodSchema>(
  schema: T,
  description: string
) => {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
    description,
  };
};

export const requestBody = (schema: any) => ({
  body: {
    content: {
      "application/json": { schema },
    },
  },
});

export const createErrorSchema = <T extends ZodSchema>(schema: T) => {
  const { error } = schema.safeParse(
    schema.type === "array"
      ? [schema.element.type.toString() === "string" ? 123 : "invalid"]
      : {}
  );

  const example = error
    ? {
        name: error.name,
        issues: error.issues.map((issue: ZodIssue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message,
        })),
      }
    : {
        name: "ZodError",
        issues: [
          {
            code: "invalid_type",
            path: ["fieldName"],
            message: "Expected string, received undefined",
          },
        ],
      };

  return z.object({
    success: z.boolean().openapi({
      example: false,
    }),
    error: z
      .object({
        issues: z.array(
          z.object({
            code: z.string(),
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string().optional(),
          })
        ),
        name: z.string(),
      })
      .openapi({
        example,
      }),
  });
};

export const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        success: result.success,
        error: {
          name: result.error.name,
          issues: result.error.issues,
        },
      },
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY
    );
  }
};

type KeysOfZodObj<T extends z.ZodObject<any>> = keyof T["shape"] & string;

// Return a typed Zod enum from a Zod schema
function enumFromSchema<T extends z.ZodObject<any>>(schema: T) {
  const keys = Object.keys(schema.shape) as KeysOfZodObj<T>[];
  return z.enum(keys as [KeysOfZodObj<T>, ...KeysOfZodObj<T>[]]);
}

// Complete pagination + ordering helper
export function paginationWithOrderingSchema<T extends z.ZodObject<any>>(
  schema: T
) {
  return z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
      order_by: enumFromSchema(schema).default("id"),
      order: z.enum(["asc", "desc"]).default("asc"),
      search: z.string().optional(),
      filters: z.string().optional().describe(`Available operators:
${Object.keys(LOOKUP_MAP).join(", ")}

Example usage:
- ?name__ilike=John
- ?age__gte=18
- ?created_at__between=2023-01-01,2023-12-31
  `),
    })
    .catchall(z.string().optional());
}

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      limit: z.number(),
      offset: z.number(),
      total: z.number(),
    }),
  });
}

export const idParamSchema = z.object({
  id: z.coerce
    .number()
    .positive()
    .int()
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      example: "1",
    }),
});
