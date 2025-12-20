import type { AppRouteHandler } from "@/utils/types";
import { createQueryBuilder } from "@/db/querybuilder";
import type { ListRoute, GetRoute, ReplayRoute } from "./replay.routes";
import { requestSnapshots as snapshotsTable } from "@/db/models/requestSnapshots";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

const snapshotsQuery =
  createQueryBuilder<typeof snapshotsTable>(snapshotsTable);

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const query = c.req.valid("query");
  const {
    limit,
    offset,
    order_by,
    order,
    search,
    method,
    path,
    statusCode,
    startDate,
    endDate,
    ...filters
  } = query;

  // Convert route-specific filters to querybuilder filter format
  const queryBuilderFilters: Record<string, any> = { ...filters };

  if (method) {
    queryBuilderFilters.method__eq = method;
  }
  if (path) {
    queryBuilderFilters.path__eq = path;
  }
  if (statusCode !== undefined) {
    queryBuilderFilters.statusCode__eq = statusCode;
  }
  if (startDate) {
    queryBuilderFilters.timestamp__gte = startDate;
  }
  if (endDate) {
    queryBuilderFilters.timestamp__lte = endDate;
  }

  const { data, total } = await snapshotsQuery.list({
    limit,
    offset,
    order_by,
    order,
    search,
    filters: queryBuilderFilters,
  });

  return c.json(
    {
      data,
      error: null,
      metadata: {
        limit,
        offset,
        total,
      },
    },
    HTTP_STATUS_CODES.OK
  );
};

export const get: AppRouteHandler<GetRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const snapshot = await snapshotsQuery.get(id);

  if (!snapshot) {
    return c.json(
      {
        data: null,
        error: { message: "Snapshot not found" },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  return c.json(
    {
      data: snapshot,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const replay: AppRouteHandler<ReplayRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const snapshot = await snapshotsQuery.get(id);

  if (!snapshot) {
    return c.json(
      {
        data: null,
        error: { message: "Snapshot not found" },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  const snap = snapshot;

  // Safety checks
  // Don't allow replaying to certain sensitive endpoints
  const blockedPaths = ["/replay", "/metrics", "/logs"];
  if (blockedPaths.some((blocked) => snap.path.includes(blocked))) {
    return c.json(
      {
        data: null,
        error: { message: "Replay not allowed for this endpoint" },
        metadata: null,
      },
      HTTP_STATUS_CODES.FORBIDDEN
    );
  }

  try {
    const start = Date.now();

    // Get base URL from request
    const urlObj = new URL(c.req.url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    // Build the request
    const url = new URL(snap.path, baseUrl);
    if (snap.query) {
      Object.entries(snap.query as Record<string, string>).forEach(
        ([key, value]) => {
          url.searchParams.set(key, value);
        }
      );
    }

    // Prepare headers (excluding sensitive ones)
    const headers: Record<string, string> = {
      "x-internal-replay": "true", // Mark as internal replay to bypass CSRF
    };
    if (snap.headers) {
      Object.entries(snap.headers as Record<string, string>).forEach(
        ([key, value]) => {
          const lowerKey = key.toLowerCase();
          // Skip sensitive headers
          if (
            !["authorization", "cookie", "x-api-key", "host"].includes(lowerKey)
          ) {
            headers[key] = value;
          }
        }
      );
    }

    // Make the request
    let response: Response;
    const method = snap.method.toLowerCase() as
      | "get"
      | "post"
      | "put"
      | "delete"
      | "patch";

    if (method === "get") {
      response = await fetch(url.toString(), { method: "GET", headers });
    } else if (method === "post") {
      response = await fetch(url.toString(), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: snap.body ? JSON.stringify(snap.body) : undefined,
      });
    } else if (method === "put") {
      response = await fetch(url.toString(), {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: snap.body ? JSON.stringify(snap.body) : undefined,
      });
    } else if (method === "delete") {
      response = await fetch(url.toString(), { method: "DELETE", headers });
    } else if (method === "patch") {
      response = await fetch(url.toString(), {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: snap.body ? JSON.stringify(snap.body) : undefined,
      });
    } else {
      return c.json(
        {
          data: null,
          error: { message: `Unsupported method: ${snap.method}` },
          metadata: null,
        },
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    const duration = Date.now() - start;

    // Parse response
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: any;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }

    return c.json(
      {
        data: {
          statusCode: response.status,
          headers: responseHeaders,
          body: responseBody,
          duration,
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    return c.json(
      {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Replay failed",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
};
