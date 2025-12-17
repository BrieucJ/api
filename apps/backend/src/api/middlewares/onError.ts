import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import env from "@/env";

const onError: ErrorHandler = (err, c) => {
  const currentStatus =
    "status" in err ? err.status : c.newResponse(null).status;
  const statusCode =
    currentStatus !== 200 ? (currentStatus as ContentfulStatusCode) : 500;

  if (err instanceof ZodError) {
    return c.json(
      {
        data: null,
        error: {
          name: err.name,
          issues: err.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
          stack: env.NODE_ENV === "production" ? undefined : err.stack,
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY
    );
  }

  // Generic errors
  return c.json(
    {
      data: null,
      error: {
        name: err.name ?? "Error",
        issues: [
          {
            code: "internal_error",
            path: [],
            message: err.message,
          },
        ],
        stack: env.NODE_ENV === "production" ? undefined : err.stack,
      },
      metadata: null,
    },
    statusCode
  );
};

export default onError;
