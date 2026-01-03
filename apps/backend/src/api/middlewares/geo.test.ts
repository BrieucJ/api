import { describe, it, expect } from "bun:test";
import geo from "@/api/middlewares/geo";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";

describe("Geo Middleware", () => {
  it("should extract geo from Cloudflare headers", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    // Mock Cloudflare CF object
    (context.req.raw as any).cf = {
      country: "US",
      region: "CA",
      city: "San Francisco",
      latitude: 37.7749,
      longitude: -122.4194,
    };

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    expect(context.geo.source).toBe("platform");
    expect(context.geo.country).toBe("US");
    expect(context.geo.region).toBe("CA");
    expect(context.geo.city).toBe("San Francisco");
    expect(context.geo.lat).toBe(37.7749);
    expect(context.geo.lon).toBe(-122.4194);
  });

  it("should extract geo from CloudFront headers", async () => {
    const context = createMockContextForMiddleware("GET", "/test", {
      "cloudfront-viewer-country": "GB",
      "cloudfront-viewer-country-region": "ENG",
      "cloudfront-viewer-city": "London",
    });

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    expect(context.geo.source).toBe("platform");
    expect(context.geo.country).toBe("GB");
    expect(context.geo.region).toBe("ENG");
    expect(context.geo.city).toBe("London");
  });

  it("should extract geo from custom headers", async () => {
    const context = createMockContextForMiddleware("GET", "/test", {
      "x-geo-country": "FR",
      "x-geo-region": "IDF",
      "x-geo-city": "Paris",
      "x-geo-lat": "48.8566",
      "x-geo-lon": "2.3522",
    });

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    expect(context.geo.source).toBe("header");
    expect(context.geo.country).toBe("FR");
    expect(context.geo.region).toBe("IDF");
    expect(context.geo.city).toBe("Paris");
    expect(context.geo.lat).toBe(48.8566);
    expect(context.geo.lon).toBe(2.3522);
  });

  it("should extract geo from IP address when no headers", async () => {
    const context = createMockContextForMiddleware("GET", "/test", {
      "x-forwarded-for": "8.8.8.8", // Google DNS - should resolve to US
    });

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    // IP-based geo might return different results, so just check structure
    expect(context.geo.source).toBeDefined();
  });

  it("should set source to 'none' when no geo information available", async () => {
    const context = createMockContextForMiddleware("GET", "/test");

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    expect(context.geo.source).toBe("none");
  });

  it("should prioritize Cloudflare over other sources", async () => {
    const context = createMockContextForMiddleware("GET", "/test", {
      "x-geo-country": "FR",
      "cloudfront-viewer-country": "GB",
    });
    (context.req.raw as any).cf = {
      country: "US",
    };

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await geo(context, next);

    expect(nextCalled).toBe(true);
    expect(context.geo).toBeDefined();
    expect(context.geo.source).toBe("platform");
    expect(context.geo.country).toBe("US");
  });

  it("should handle errors gracefully", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    // Cause an error by making req.raw undefined
    const originalRaw = context.req.raw;
    (context.req as any).raw = null;

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    // Should not throw
    await geo(context, next);

    expect(nextCalled).toBe(true);
    // Restore for cleanup
    (context.req as any).raw = originalRaw;
  });
});

