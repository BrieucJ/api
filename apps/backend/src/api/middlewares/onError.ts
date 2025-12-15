import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError, z } from "zod";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import env from "@/env";
const onError: ErrorHandler = (err, c) => {
  console.log("err", err);
  const currentStatus =
    "status" in err ? err.status : c.newResponse(null).status;
  const statusCode =
    currentStatus !== 200 ? (currentStatus as ContentfulStatusCode) : 500;
  // eslint-disable-next-line node/prefer-global/process

  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          name: err.name,
          issues: err.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
        },
      },
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY
    );
  }

  return c.json(
    {
      message: err.message,
      stack: env.NODE_ENV === "production" ? undefined : err.stack,
    },
    statusCode
  );
};

export default onError;
