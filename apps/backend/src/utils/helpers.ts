import { z, type ZodTypeAny } from "zod";
import type { Hook } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { LOOKUP_MAP } from "@/db/querybuilder";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  serveEmojiFavicon,
  geo,
  metrics,
  snapshot,
  logging,
  securityHeaders,
  bodyLimit,
} from "@/api/middlewares";
import { requestId } from "hono/request-id";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { languageDetector } from "hono/language";
import { timing } from "hono/timing";
import { compress } from "hono/compress";
import type { AppBindings } from "./types";
import { onError, notFound } from "@/api/middlewares";
import type {
  KeysOfZodObj,
  ZodSchema,
  ZodSchema as ZodSchemaType,
  ZodIssue,
} from "@/utils/types";
import env from "@/env";

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
        data: null,
        error: {
          name: result.error.name,
          issues: result.error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
          stack: env.NODE_ENV === "production" ? undefined : result.error.stack,
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY
    );
  }
};

// Return a typed Zod enum from a Zod schema
function enumFromSchema<T extends z.ZodObject<any>>(schema: T) {
  const keys = Object.keys(schema.shape) as KeysOfZodObj<T>[];
  return z.enum(keys as [KeysOfZodObj<T>, ...KeysOfZodObj<T>[]]);
}

/**
 * Creates a reusable select field schema that accepts comma-separated strings or JSON arrays
 * @param fieldEnum - The Zod enum of allowed field names
 * @returns A Zod schema for the select parameter
 */
export function createSelectSchema<T extends z.ZodEnum<any>>(fieldEnum: T) {
  return z
    .preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);
        }
      }
      return val;
    }, z.array(fieldEnum).min(1))
    .optional()
    .openapi({
      param: {
        name: "select",
        in: "query",
      },
      description:
        'Comma-separated list of fields to select, or JSON array. Example: \'id,email,role\' or \'["id","email","role"]\'',
      example: "id,email,role",
    });
}

/**
 * Creates a reusable ordering schema that accepts objects, arrays, or JSON strings
 * Querybuilder format: order_by={"field":"id","order":"asc"} or order_by=[{"field":"id","order":"asc"},{"field":"name","order":"desc"}]
 * @param fieldEnum - The Zod enum of allowed field names
 * @returns A Zod schema for the order_by parameter
 */

export function createOrderingSchema<T extends z.ZodEnum<any>>(fieldEnum: T) {
  const orderItem = z.object({
    field: fieldEnum,
    order: z.enum(["asc", "desc"]),
  });

  return z
    .preprocess((val) => {
      // undefined, null, or empty string → treat as empty array
      if (val === undefined || val === null || val === "") return [];

      // if array or object already, leave it
      if (typeof val === "object") return val;

      // if string, try JSON.parse
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          // optional: parse shorthand like "id:asc"
          const [field, order] = val.split(":");
          if (
            fieldEnum.options.includes(field) &&
            ["asc", "desc"].includes(order ?? "")
          ) {
            return [{ field, order }];
          }
          return []; // fallback to empty array
        }
      }

      return val;
    }, z.union([orderItem, z.array(orderItem)]))
    .transform((val) => (Array.isArray(val) ? val : [val])) // always array// mark the whole thing optional for Hono
    .openapi({
      param: {
        name: "order_by",
        in: "query",
      },
      example: { field: "id", order: "asc" },
    })
    .optional();
}

// Complete pagination + ordering helper
// Querybuilder format: order_by={"field":"id","order":"asc"} or order_by=[{"field":"id","order":"asc"},{"field":"name","order":"desc"}]
export function paginationWithOrderingSchema<T extends z.ZodObject<any>>(
  schema: T
) {
  const orderByFieldEnum = enumFromSchema(schema);
  const selectFieldEnum = enumFromSchema(schema); // For select field validation

  return z
    .object({
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(1000)
        .openapi({
          param: {
            name: "limit",
            in: "query",
          },
          example: 20,
        })
        .default(20),
      offset: z.coerce
        .number()
        .int()
        .min(0)
        .openapi({
          param: {
            name: "offset",
            in: "query",
          },
          example: 0,
        })
        .default(0),
      order_by: createOrderingSchema(orderByFieldEnum),
      select: createSelectSchema(selectFieldEnum),
      search: z.string().optional(),
      filters: z.string().optional()
        .describe(`Filter conditions as query parameters (AND by default).
Available operators: ${Object.keys(LOOKUP_MAP).join(", ")}

Example usage (AND conditions):
- ?name__ilike=John
- ?age__gte=18
- ?name__ilike=John&age__gte=18 (both conditions must match)

For OR conditions, pass filters as JSON string:
- ?filters=[{"name__eq":"John"},{"name__eq":"Bob"}] (John OR Bob)
- ?filters=[{"name__eq":"John","age__gte":30},{"name__eq":"Bob","age__gte":25}] (complex OR)
  `),
    })
    .passthrough();
}

type NullableInfer<T extends ZodTypeAny | null> = T extends ZodTypeAny
  ? z.infer<T> | null
  : null;

export const responseSchema = <
  T extends ZodTypeAny | null = null,
  E extends ZodTypeAny | null = null,
  M extends ZodTypeAny | null = null
>(
  description: string,
  dataSchema?: T,
  errorSchema?: E,
  metadataSchema?: M
) => {
  const schema = z.object({
    data: dataSchema ? dataSchema : z.null(),
    error: errorSchema ? errorSchema : z.null(),
    metadata: metadataSchema ? metadataSchema : z.null(),
  }) as z.ZodObject<{
    data: z.ZodType<NullableInfer<T>>;
    error: z.ZodType<NullableInfer<E>>;
    metadata: z.ZodType<NullableInfer<M>>;
  }>;

  return {
    schema,
    content: { "application/json": { schema } },
    description,
  };
};

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

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    defaultHook,
    strict: false,
  });
}

export function createApp() {
  const app = createRouter();
  app.use(requestId());
  app.use(securityHeaders);
  app.use(compress()); // Response compression (gzip/brotli)
  app.use(bodyLimit); // Request size limits for DoS protection
  app.use(serveEmojiFavicon("🚀"));
  app.notFound(notFound);
  app.onError(onError);
  app.use(requestId());
  app.use(
    cors({
      origin: (origin) => {
        // Allow requests without origin (same-origin, Postman, etc.)
        if (!origin) {
          return "http://localhost:5173";
        }

        // Allow localhost for development (any port)
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return origin;
        }

        // Allow CloudFront distributions (production)
        if (origin.includes("cloudfront.net")) {
          return origin;
        }

        // Default fallback for development
        return "http://localhost:5173";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Type"],
      maxAge: 600,
      credentials: true,
    })
  );
  // CSRF middleware that skips internal replay requests
  app.use(async (c, next) => {
    const isInternalReplay = c.req.header("x-internal-replay") === "true";
    const origin = c.req.header("origin");
    const host = c.req.header("host");

    // Check if request is from same origin (internal) or localhost
    const isInternalRequest =
      isInternalReplay ||
      !origin ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      (host &&
        (origin?.includes(`http://${host}`) ||
          origin?.includes(`https://${host}`)));

    if (isInternalRequest) {
      await next();
      return;
    }

    // Apply CSRF for external requests
    return csrf()(c, next);
  });
  app.use(
    languageDetector({
      fallbackLanguage: "en",
    })
  );
  app.use(timing());
  app.use(geo);
  app.use(metrics);
  app.use(snapshot);
  app.use(logging);
  return app;
}

export const jsonContentRequired = <T extends ZodSchema>(
  schema: T,
  description: string
) => {
  return {
    ...jsonContent(schema, description),
    required: true,
  };
};

export const notFoundSchema = z
  .object({ message: z.string() })
  .openapi({ example: { message: "Not Found" } });

export const internalServerErrorSchema = z
  .object({
    name: z.string().openapi({ example: "Error" }),
    message: z
      .string()
      .optional()
      .openapi({ example: "Internal server error" }),
    issues: z
      .array(
        z.object({
          code: z.string(),
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string().optional(),
        })
      )
      .optional()
      .openapi({
        example: [
          {
            code: "internal_error",
            path: [],
            message: "An unexpected error occurred",
          },
        ],
      }),
    stack: z.string().optional().openapi({ example: undefined }),
  })
  .openapi({
    example: {
      name: "Error",
      message: "Internal server error",
      issues: [
        {
          code: "internal_error",
          path: [],
          message: "An unexpected error occurred",
        },
      ],
    },
  });

export const paginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

/**
 * Creates a query schema with select field for single record routes (get, patch, etc.)
 * @param schema - The Zod schema to generate field enum from
 * @returns Query schema object with select field
 */
export function selectFieldSchema<T extends z.ZodObject<any>>(schema: T) {
  const fieldEnum = enumFromSchema(schema);
  return {
    query: z.object({
      select: createSelectSchema(fieldEnum),
    }),
  };
}

/**
 * Creates standard responses for a list endpoint
 * @param resourceName - Name of the resource (e.g., "users", "logs")
 * @param selectSchema - The schema for a single item
 * @param options - Optional configuration
 */
export function createListResponses<T extends ZodTypeAny>(
  resourceName: string,
  selectSchema: T,
  options?: {
    customDescription?: string;
  }
) {
  const responses: Record<number, any> = {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      options?.customDescription || `List ${resourceName}`,
      z.array(selectSchema),
      null,
      paginationSchema
    ),
    [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: responseSchema(
      "Internal server error",
      null,
      internalServerErrorSchema,
      null
    ),
  };

  return responses;
}

/**
 * Creates standard responses for a get (by ID) endpoint
 * @param resourceName - Name of the resource (singular, e.g., "user", "log")
 * @param selectSchema - The schema for the item
 * @param options - Optional configuration
 */
export function createGetResponses<T extends ZodTypeAny>(
  resourceName: string,
  selectSchema: T,
  options?: {
    customDescription?: string;
    customNotFoundMessage?: string;
  }
) {
  const responses: Record<number, any> = {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      options?.customDescription || `Get ${resourceName} by ID`,
      selectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      options?.customNotFoundMessage ||
        `${
          resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        } not found`,
      null,
      notFoundSchema,
      z.object({ id: z.number() })
    ),
    [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: responseSchema(
      "Internal server error",
      null,
      internalServerErrorSchema,
      null
    ),
  };

  return responses;
}

/**
 * Creates standard responses for a create endpoint
 * @param resourceName - Name of the resource (singular, e.g., "user")
 * @param selectSchema - The schema for the created item
 * @param insertSchema - The schema for the insert/input data
 * @param options - Optional configuration
 */
export function createCreateResponses<
  TSelect extends ZodTypeAny,
  TInsert extends ZodTypeAny
>(
  resourceName: string,
  selectSchema: TSelect,
  insertSchema: TInsert,
  options?: {
    includeValidationErrors?: boolean;
    customDescription?: string;
  }
) {
  const responses: Record<number, any> = {
    [HTTP_STATUS_CODES.CREATED]: responseSchema(
      options?.customDescription || `The created ${resourceName}`,
      selectSchema,
      null,
      null
    ),
  };

  if (options?.includeValidationErrors !== false) {
    responses[HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY] = responseSchema(
      "Validation errors",
      null,
      createErrorSchema(insertSchema as unknown as ZodSchemaType),
      null
    );
  }

  responses[HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR] = responseSchema(
    "Internal server error",
    null,
    internalServerErrorSchema,
    null
  );

  return responses;
}

/**
 * Creates standard responses for an update endpoint
 * @param resourceName - Name of the resource (singular, e.g., "user")
 * @param selectSchema - The schema for the updated item
 * @param updateSchema - The schema for the update/input data
 * @param options - Optional configuration
 */
export function createUpdateResponses<
  TSelect extends ZodTypeAny,
  TUpdate extends ZodTypeAny
>(
  resourceName: string,
  selectSchema: TSelect,
  updateSchema: TUpdate,
  options?: {
    includeValidationErrors?: boolean;
    customDescription?: string;
    customNotFoundMessage?: string;
  }
) {
  const responses: Record<number, any> = {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      options?.customDescription ||
        `${
          resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        } updated`,
      selectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      options?.customNotFoundMessage ||
        `${
          resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        } not found`,
      null,
      notFoundSchema,
      z.object({ id: z.number() })
    ),
  };

  if (options?.includeValidationErrors !== false) {
    responses[HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY] = responseSchema(
      "Validation errors",
      null,
      createErrorSchema(updateSchema as unknown as ZodSchemaType),
      null
    );
  }

  responses[HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR] = responseSchema(
    "Internal server error",
    null,
    internalServerErrorSchema,
    null
  );

  return responses;
}

/**
 * Creates standard responses for a delete endpoint
 * @param resourceName - Name of the resource (singular, e.g., "user")
 * @param selectSchema - The schema for the deleted item (or a subset)
 * @param options - Optional configuration
 */
export function createDeleteResponses<T extends ZodTypeAny>(
  resourceName: string,
  selectSchema: T,
  options?: {
    customDescription?: string;
    customNotFoundMessage?: string;
  }
) {
  const responses: Record<number, any> = {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      options?.customDescription ||
        `${
          resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        } deleted`,
      selectSchema,
      null,
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      options?.customNotFoundMessage ||
        `${
          resourceName.charAt(0).toUpperCase() + resourceName.slice(1)
        } not found`,
      null,
      notFoundSchema,
      z.object({ id: z.number() })
    ),
    [HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR]: responseSchema(
      "Internal server error",
      null,
      internalServerErrorSchema,
      null
    ),
  };

  return responses;
}
