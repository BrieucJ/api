import { describe, it, expect } from "bun:test";
import serveEmojiFavicon from "@/api/middlewares/serveEmoji";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";

describe("Serve Emoji Middleware", () => {
  it("should serve favicon for /favicon.ico path", async () => {
    const emoji = "🚀";
    const middleware = serveEmojiFavicon(emoji);
    const context = createMockContextForMiddleware("GET", "/favicon.ico");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(context, next);

    expect(nextCalled).toBe(false);
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const body = await response.text();
    expect(body).toContain(emoji);
    expect(body).toContain("<svg");
  });

  it("should not serve favicon for other paths", async () => {
    const emoji = "🚀";
    const middleware = serveEmojiFavicon(emoji);
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await middleware(context, next);

    expect(nextCalled).toBe(true);
    expect(result).toBeUndefined();
  });

  it("should handle different emojis", async () => {
    const emoji = "🔥";
    const middleware = serveEmojiFavicon(emoji);
    const context = createMockContextForMiddleware("GET", "/favicon.ico");
    const next = async () => {};

    const result = await middleware(context, next);
    const body = await (result as Response).text();

    expect(body).toContain(emoji);
  });

  it("should return valid SVG", async () => {
    const emoji = "⭐";
    const middleware = serveEmojiFavicon(emoji);
    const context = createMockContextForMiddleware("GET", "/favicon.ico");
    const next = async () => {};

    const result = await middleware(context, next);
    const body = await (result as Response).text();

    expect(body).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(body).toContain('viewBox="0 0 100 100"');
  });
});

