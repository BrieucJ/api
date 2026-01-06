import { describe, it, expect } from "bun:test";
import { getJobService } from "@/utils/jobService";
import { JobType } from "@/jobs/types";
import type { JobResult } from "@/utils/types";

describe("Process Metrics Handler", () => {
  it("should process metrics without throwing", async () => {
    const payload = {
      windowStart: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      windowEnd: new Date().toISOString(),
    };

    const jobService = getJobService();
    const result: JobResult = await jobService.execute(
      JobType.PROCESS_METRICS,
      payload
    );

    // Verify return type structure
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("metadata");
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.jobType).toBe(JobType.PROCESS_METRICS);
    expect(result.metadata.jobId).toBeDefined();
    expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
  });

  it("should handle valid date ranges", async () => {
    const payload = {
      windowStart: new Date("2024-01-01T00:00:00Z").toISOString(),
      windowEnd: new Date("2024-01-01T01:00:00Z").toISOString(),
    };

    const jobService = getJobService();
    const result: JobResult = await jobService.execute(
      JobType.PROCESS_METRICS,
      payload
    );

    // Verify return type structure
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("metadata");
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.metadata).toBeDefined();
  });

  it("should handle different time windows", async () => {
    const now = new Date();
    const payload = {
      windowStart: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      windowEnd: now.toISOString(),
    };

    const jobService = getJobService();
    const result: JobResult = await jobService.execute(
      JobType.PROCESS_METRICS,
      payload
    );

    // Verify return type structure
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("metadata");
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.metadata).toBeDefined();
  });
});
