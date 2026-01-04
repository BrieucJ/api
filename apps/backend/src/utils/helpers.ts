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
import type { KeysOfZodObj, ZodSchema, ZodIssue } from "@/utils/types";
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

// Complete pagination + ordering helper
// Querybuilder format: order_by={"field":"id","order":"asc"} or order_by=[{"field":"id","order":"asc"},{"field":"name","order":"desc"}]
export function paginationWithOrderingSchema<T extends z.ZodObject<any>>(
  schema: T
) {
  const orderByFieldEnum = enumFromSchema(schema);

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
      // Querybuilder format: order_by={"field":"id","order":"asc"} or order_by=[{"field":"id","order":"asc"},{"field":"name","order":"desc"}]
      // Accepts both JSON string and object (for API tools like Scalar)
      order_by: z
        .union([
          z.object({
            field: orderByFieldEnum,
            order: z.enum(["asc", "desc"]),
          }),
          z.array(
            z.object({
              field: orderByFieldEnum,
              order: z.enum(["asc", "desc"]),
            })
          ),
          z.string().transform((val, ctx) => {
            // Parse as JSON for querybuilder format
            try {
              const parsed = JSON.parse(val);
              // Validate it matches querybuilder format
              if (typeof parsed === "object" && parsed !== null) {
                if (Array.isArray(parsed)) {
                  const orderByArraySchema = z.array(
                    z.object({
                      field: orderByFieldEnum,
                      order: z.enum(["asc", "desc"]),
                    })
                  );
                  return orderByArraySchema.parse(parsed);
                } else if ("field" in parsed && "order" in parsed) {
                  // Object format: {field: "id", order: "asc"}
                  const orderByObjectSchema = z.object({
                    field: orderByFieldEnum,
                    order: z.enum(["asc", "desc"]),
                  });
                  return orderByObjectSchema.parse(parsed);
                }
              }
              throw new Error("Invalid order_by format");
            } catch (e) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `order_by must be valid JSON matching querybuilder format: {"field":"id","order":"asc"} or [{"field":"id","order":"asc"}]`,
              });
              return z.NEVER;
            }
          }),
        ])
        .default({ field: "id", order: "asc" })
        .openapi({
          param: {
            name: "order_by",
            in: "query",
          },
          example: JSON.stringify({ field: "id", order: "asc" }),
        }),
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
    .loose();
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
    data: dataSchema ? dataSchema.nullable() : z.null(),
    error: errorSchema ? errorSchema.nullable() : z.null(),
    metadata: metadataSchema ? metadataSchema.nullable() : z.null(),
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
    // Skip CSRF for internal replay requests (identified by special header)
    // or requests from localhost/127.0.0.1
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
  app.use("/api/v1/*", logging);
  // Also apply logging to auth routes for debugging
  app.use("/auth/*", logging);
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

export const paginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});
