import { describe, it, expect } from "bun:test";
import { processMetrics } from "@/jobs/handlers/processMetrics";

describe("Process Metrics Handler", () => {
  it("should process metrics without throwing", async () => {
    const payload = {
      windowStart: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      windowEnd: new Date().toISOString(),
    };

    // Should not throw
    await processMetrics(payload);
    expect(true).toBe(true);
  });

  it("should handle valid date ranges", async () => {
    const payload = {
      windowStart: new Date("2024-01-01T00:00:00Z").toISOString(),
      windowEnd: new Date("2024-01-01T01:00:00Z").toISOString(),
    };

    await processMetrics(payload);
    expect(true).toBe(true);
  });

  it("should handle different time windows", async () => {
    const now = new Date();
    const payload = {
      windowStart: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      windowEnd: now.toISOString(),
    };

    await processMetrics(payload);
    expect(true).toBe(true);
  });
});
