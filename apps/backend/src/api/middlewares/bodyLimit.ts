import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

/**
 * Body Size Limit Middleware
 *
 * Protects against DoS attacks by limiting request payload sizes:
 * - JSON requests: 1MB limit
 * - Form data: 10MB limit
 * - File uploads: 50MB limit
 * - Other content: 1MB limit
 *
 * Returns 413 Payload Too Large if limits are exceeded
 */

const SIZE_LIMITS = {
  JSON: 1 * 1024 * 1024, // 1MB for JSON
  FORM: 10 * 1024 * 1024, // 10MB for form data
  FILE: 50 * 1024 * 1024, // 50MB for file uploads
  DEFAULT: 1 * 1024 * 1024, // 1MB default
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getContentLength(c: Context): number | null {
  const contentLength = c.req.header("content-length");
  if (!contentLength) return null;
  const length = parseInt(contentLength, 10);
  return isNaN(length) ? null : length;
}

function getSizeLimit(contentType: string | undefined): number {
  if (!contentType) return SIZE_LIMITS.DEFAULT;

  if (contentType.includes("application/json")) {
    return SIZE_LIMITS.JSON;
  }
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    return SIZE_LIMITS.FORM;
  }
  if (
    contentType.includes("image/") ||
    contentType.includes("video/") ||
    contentType.includes("application/octet-stream")
  ) {
    return SIZE_LIMITS.FILE;
  }

  return SIZE_LIMITS.DEFAULT;
}

const bodyLimit = createMiddleware(async (c: Context, next) => {
  // Only check body size for methods that can have a body
  const method = c.req.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await next();
    return;
  }

  const contentType = c.req.header("content-type");
  const contentLength = getContentLength(c);

  // If no content-length header, let the request through
  // (we'll rely on the framework's timeout to handle issues)
  if (contentLength === null) {
    await next();
    return;
  }

  const sizeLimit = getSizeLimit(contentType);

  // Check if content length exceeds the limit
  if (contentLength > sizeLimit) {
    return c.json(
      {
        data: null,
        error: {
          message: "Payload Too Large",
          details: `Request body size (${formatBytes(
            contentLength
          )}) exceeds maximum allowed size (${formatBytes(sizeLimit)})`,
          contentType: contentType || "unknown",
          receivedSize: contentLength,
          maxSize: sizeLimit,
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.REQUEST_TOO_LONG
    );
  }

  await next();
});

export default bodyLimit;

// Export limits for testing or configuration
export { SIZE_LIMITS };
