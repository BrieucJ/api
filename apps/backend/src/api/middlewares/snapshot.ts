import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import {
  requestSnapshots,
  snapshotInsertSchema,
} from "@/db/models/requestSnapshots";
import { createQueryBuilder } from "@/db/querybuilder";
import env from "@/env";
import packageJSON from "../../../package.json";
import { logger } from "@/utils/logger";

const snapshotsQuery =
  createQueryBuilder<typeof requestSnapshots>(requestSnapshots);

const snapshotMiddleware = createMiddleware(async (c: Context, next) => {
  const path = c.req.path;

  // Only track public endpoints that start with /api/v1
  if (!path.startsWith("/api/v1")) {
    await next();
    return;
  }

  const start = Date.now();
  const method = c.req.method;
  let requestBody: any = null;
  let queryParams: Record<string, string> | null = null;
  const headers: Record<string, string> = {};

  // Capture request headers (excluding sensitive ones)
  c.req.raw.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    // Skip sensitive headers
    if (!["authorization", "cookie", "x-api-key"].includes(lowerKey)) {
      headers[key] = value;
    }
  });

  // Capture query params
  try {
    const url = new URL(c.req.url);
    queryParams = Object.fromEntries(url.searchParams.entries());
  } catch {
    // Ignore if URL parsing fails
  }

  // Capture request body (only if Content-Type is JSON)
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      // Try to parse JSON body if available in context
      // Note: This won't work if body hasn't been parsed yet, but that's okay
      // We'll capture it after next() if possible
      const body = await c.req.json().catch(() => null);
      if (body) {
        requestBody = body;
      }
    } catch {
      // Body might not be available yet, we'll try again after next()
    }
  }

  // Get user ID from context if available
  const userId = (c as any).user?.id || c.req.header("x-user-id") || null;

  // Get geo information from context if available
  const geoInfo = (c as any).geo || null;
  const geoCountry = geoInfo?.country || null;
  const geoRegion = geoInfo?.region || null;
  const geoCity = geoInfo?.city || null;
  const geoLat = geoInfo?.lat || null;
  const geoLon = geoInfo?.lon || null;
  const geoSource = geoInfo?.source || null;

  let statusCode: number | null = null;
  let responseBody: any = null;
  let responseHeaders: Record<string, string> = {};

  try {
    await next();

    const duration = Date.now() - start;
    statusCode = c.res.status || 200;

    // Capture response headers
    c.res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Try to capture response body (optional, can be disabled for large responses)
    // Only if response is JSON and small
    const responseContentType = c.res.headers.get("content-type") || "";
    if (responseContentType.includes("application/json")) {
      try {
        const cloned = c.res.clone();
        const text = await cloned.text();
        if (text && text.length < 10000) {
          // Only capture if response is small enough
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        }
      } catch {
        // Ignore if we can't read response
      }
    }

    // Store snapshot asynchronously (don't block response)
    // Use setTimeout instead of setImmediate for better compatibility
    setTimeout(async () => {
      try {
        // Capture test job ID from header if present
        const testJobId = c.req.header("x-test-job-id") || undefined;

        const data = snapshotInsertSchema.parse({
          method,
          path,
          query: queryParams || undefined,
          body: requestBody || undefined,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          userId: userId || undefined,
          version: packageJSON.version || "1.0.0",
          stage: env.NODE_ENV || "development",
          statusCode,
          responseBody: responseBody || undefined,
          responseHeaders:
            Object.keys(responseHeaders).length > 0
              ? responseHeaders
              : undefined,
          duration,
          geoCountry: geoCountry ?? null,
          geoRegion: geoRegion ?? null,
          geoCity: geoCity ?? null,
          geoLat: geoLat ?? null,
          geoLon: geoLon ?? null,
          geoSource: geoSource ?? null,
        });

        await snapshotsQuery.create(data);
      } catch (error) {
        logger.error("Failed to store snapshot", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }, 0);
  } catch (error) {
    const duration = Date.now() - start;
    statusCode = 500;

    // Store error snapshot
    setTimeout(async () => {
      try {
        const data = snapshotInsertSchema.parse({
          method,
          path,
          query: queryParams || undefined,
          body: requestBody || undefined,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          userId: userId || undefined,
          version: packageJSON.version || "1.0.0",
          stage: env.NODE_ENV || "development",
          statusCode,
          responseBody:
            error instanceof Error
              ? { error: error.message, stack: error.stack }
              : undefined,
          duration,
          geoCountry: geoCountry ?? null,
          geoRegion: geoRegion ?? null,
          geoCity: geoCity ?? null,
          geoLat: geoLat ?? null,
          geoLon: geoLon ?? null,
          geoSource: geoSource ?? null,
        });

        await snapshotsQuery.create(data);
      } catch (err) {
        logger.error("Failed to store error snapshot", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    });

    throw error;
  }
});

export default snapshotMiddleware;
