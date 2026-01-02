import { createMiddleware } from "hono/factory";
import { logger } from "@/utils/logger";
import type { Context } from "hono";
import env from "@/env";
import packageJSON from "../../../package.json";

function serializeContext(
  c: Context,
  requestBody?: any,
  responseBody?: any,
  durationMs?: number
) {
  // Safely serialize bodies, handling circular references
  const safeSerialize = (body: any, label: string) => {
    try {
      if (body !== null && body !== undefined) {
        // Test if it can be stringified
        JSON.stringify(body);
        return body;
      }
      return null;
    } catch (e) {
      return `[Unable to serialize ${label}]`;
    }
  };

  return {
    requestId: (c.req as any).id, // requestId from middleware
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    headers: c.req.header(),
    query: c.req.query(),
    params: c.req.param ? c.req.param() : {},
    requestBody: safeSerialize(requestBody, "request body"),
    responseBody: safeSerialize(responseBody, "response body"),
    geo: c.geo || null,
    status: c.res.status || 200,
    stage: env.NODE_ENV,
    version: packageJSON.version,
    hostname: c.env?.hostname,
    port: c.env?.port,
    finalized: c.finalized,
    durationMs,
  };
}

const loggingMiddleware = createMiddleware(async (c: Context, next) => {
  const start = Date.now();

  // Capture request body for POST/PUT/PATCH requests
  let requestBody: any = null;
  let bodyText: string | null = null;

  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    try {
      const contentType = c.req.header("content-type");
      if (contentType?.includes("application/json")) {
        // Read the body as text first
        bodyText = await c.req.text();

        // Parse it for logging
        if (bodyText) {
          try {
            requestBody = JSON.parse(bodyText);
          } catch (e) {
            requestBody = bodyText;
          }
        }

        // Recreate the request with the body so it can be read again by validators
        const newRequest = new Request(c.req.url, {
          method: c.req.method,
          headers: c.req.raw.headers,
          body: bodyText,
        });

        // Replace the request in the context
        (c.req as any).raw = newRequest;
      }
    } catch (e) {
      // If we can't parse the request body, just skip it
      requestBody = null;
    }
  }

  // Log the incoming request (now synchronous)
  logger.info(`→ ${c.req.method} ${c.req.url}`, {
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    headers: c.req.header(),
    query: c.req.query(),
    requestBody,
  });

  // Store the original json method
  const originalJson = c.json.bind(c);
  let responseBody: any = null;

  // Override the json method to capture the response body
  c.json = (object: any, status?: any, headers?: any) => {
    responseBody = object;
    return originalJson(object, status, headers);
  };

  try {
    // Continue to next middleware / route
    await next();

    // After response, log completion with captured bodies
    const durationMs = Date.now() - start;
    const meta = serializeContext(c, requestBody, responseBody, durationMs);
    logger.info(
      `← ${c.req.method} ${c.req.url} [${c.res.status}] ${durationMs}ms`,
      meta
    );
  } catch (err) {
    // Log errors with structured meta
    const durationMs = Date.now() - start;
    const meta = serializeContext(c, requestBody, null, durationMs);

    logger.error(
      `✗ ${c.req.method} ${c.req.url} ${
        err instanceof Error ? err.message : String(err)
      }`,
      {
        ...meta,
        stack: err instanceof Error ? err.stack : undefined,
      }
    );

    throw err; // Let Hono handle the error
  }
});

export default loggingMiddleware;
