import { describe, it, expect } from "bun:test";
import bodyLimit, { SIZE_LIMITS } from "@/api/middlewares/bodyLimit";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

describe("Body Limit Middleware", () => {
  it("should allow requests without body for GET method", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should allow requests without Content-Length header", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/json",
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should allow JSON requests within size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/json",
      "Content-Length": (SIZE_LIMITS.JSON - 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should reject JSON requests exceeding size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/json",
      "Content-Length": (SIZE_LIMITS.JSON + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(HTTP_STATUS_CODES.REQUEST_TOO_LONG);
    const body = (await response.json()) as {
      error: {
        message: string;
        details: string;
      };
    };
    expect(body.error).toBeDefined();
    expect(body.error.message).toBe("Payload Too Large");
    expect(body.error.details).toContain("exceeds maximum allowed size");
  });

  it("should allow form data requests within size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "multipart/form-data",
      "Content-Length": (SIZE_LIMITS.FORM - 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should reject form data requests exceeding size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "multipart/form-data",
      "Content-Length": (SIZE_LIMITS.FORM + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(HTTP_STATUS_CODES.REQUEST_TOO_LONG);
  });

  it("should allow file uploads within size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "image/png",
      "Content-Length": (SIZE_LIMITS.FILE - 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should reject file uploads exceeding size limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "image/png",
      "Content-Length": (SIZE_LIMITS.FILE + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(HTTP_STATUS_CODES.REQUEST_TOO_LONG);
  });

  it("should use default limit for unknown content types", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/unknown",
      "Content-Length": (SIZE_LIMITS.DEFAULT - 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await bodyLimit(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should reject unknown content types exceeding default limit", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/unknown",
      "Content-Length": (SIZE_LIMITS.DEFAULT + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(HTTP_STATUS_CODES.REQUEST_TOO_LONG);
  });

  it("should handle PUT method", async () => {
    const context = createMockContextForMiddleware("PUT", "/test", {
      "Content-Type": "application/json",
      "Content-Length": (SIZE_LIMITS.JSON + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
  });

  it("should handle PATCH method", async () => {
    const context = createMockContextForMiddleware("PATCH", "/test", {
      "Content-Type": "application/json",
      "Content-Length": (SIZE_LIMITS.JSON + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
  });

  it("should handle DELETE method", async () => {
    const context = createMockContextForMiddleware("DELETE", "/test", {
      "Content-Type": "application/json",
      "Content-Length": (SIZE_LIMITS.JSON + 1000).toString(),
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await bodyLimit(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
  });
});
