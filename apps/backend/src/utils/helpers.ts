import { z, type ZodTypeAny } from "zod";
import type { Hook } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { LOOKUP_MAP } from "@/db/querybuilder";
import { OpenAPIHono } from "@hono/zod-openapi";
import { serveEmojiFavicon, geo } from "@/api/middlewares";
import { logger } from "@/utils/logger";
import { requestId } from "hono/request-id";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { languageDetector } from "hono/language";
import { timing } from "hono/timing";
import type { AppBindings } from "./types";
import { onError, notFound } from "@/api/middlewares";
import type { KeysOfZodObj, ZodSchema, ZodIssue } from "@/utils/types";

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
          stack:
            process.env.NODE_ENV === "production"
              ? undefined
              : result.error.stack,
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
export function paginationWithOrderingSchema<T extends z.ZodObject<any>>(
  schema: T
) {
  return z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
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
  });
  // .catchall(z.string().optional());
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

export function createApp(basePath = "/api/v1") {
  const app = createRouter();
  app.basePath(basePath);
  app.use(requestId());
  app.use(serveEmojiFavicon("🚀"));
  app.notFound(notFound);
  app.onError(onError);
  app.use(requestId());
  app.use(
    cors({
      origin: "http://localhost:5173",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
      credentials: true,
    })
  );
  app.use(csrf());
  app.use(
    languageDetector({
      fallbackLanguage: "en",
    })
  );
  app.use(timing());
  app.use(geo);
  app.use(async (c, next) => {
    try {
      logger.info(`${c.req.method} ${c.req.url}`);
      logger.debug(c);
      await next();
    } catch (err) {
      // Log the error with stack trace if available
      logger.error(err instanceof Error ? err.stack || err.message : err);
      throw err; // rethrow so Hono's onError still handles it
    }
  });
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
