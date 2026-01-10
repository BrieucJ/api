import { describe, it, expect, beforeEach } from "bun:test";
import { getJobService } from "@/utils/jobService";
import { JobType } from "@/jobs/types";
import { resetTestDatabase, withTransaction, retryUntil } from "@shared/utils";
import { metrics } from "@shared/db";
import { createQueryBuilder } from "@shared/db";
import type { JobResult } from "@/utils/types";

const metricsQuery = createQueryBuilder<typeof metrics>(metrics);

describe("Process Raw Metrics Handler", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it(
    "should process raw metrics and create aggregated metrics",
    withTransaction(async () => {
      const now = Date.now();
      const payload = {
        metrics: [
          {
            endpoint: "/api/v1/users",
            latency: 100,
            status: 200,
            timestamp: now,
            requestSize: 1024,
            responseSize: 2048,
          },
          {
            endpoint: "/api/v1/users",
            latency: 150,
            status: 200,
            timestamp: now + 1000,
            requestSize: 2048,
            responseSize: 4096,
          },
          {
            endpoint: "/api/v1/users",
            latency: 200,
            status: 500,
            timestamp: now + 2000,
          },
        ],
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.PROCESS_RAW_METRICS,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.jobType).toBe(JobType.PROCESS_RAW_METRICS);
      expect(result.metadata.jobId).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);

      // Retry query to handle CI timing issues
      const { data } = await retryUntil(
        async () => {
          const queryResult = await metricsQuery.list({
            filters: { endpoint__eq: "/api/v1/users" },
            limit: 10,
          });
          if (queryResult.data.length === 0) {
            throw new Error("No metrics found yet");
          }
          return queryResult;
        },
        { maxAttempts: 10, delayMs: 100 }
      );

      expect(data.length).toBeGreaterThan(0);
      const metric = data[0];
      expect(metric?.endpoint).toBe("/api/v1/users");
      expect(metric?.traffic_count).toBe(3);
      expect(metric?.p50_latency).toBeGreaterThanOrEqual(0);
      expect(metric?.p95_latency).toBeGreaterThanOrEqual(0);
      expect(metric?.p99_latency).toBeGreaterThanOrEqual(0);
    })
  );

  it(
    "should calculate error rate correctly",
    withTransaction(async () => {
      const now = Date.now();
      const payload = {
        metrics: [
          {
            endpoint: "/api/v1/test",
            latency: 100,
            status: 200,
            timestamp: now,
          },
          {
            endpoint: "/api/v1/test",
            latency: 150,
            status: 500,
            timestamp: now + 1000,
          },
          {
            endpoint: "/api/v1/test",
            latency: 200,
            status: 404,
            timestamp: now + 2000,
          },
        ],
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.PROCESS_RAW_METRICS,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      // Retry query to handle CI timing issues
      const { data } = await retryUntil(
        async () => {
          const queryResult = await metricsQuery.list({
            filters: { endpoint__eq: "/api/v1/test" },
            limit: 1,
          });
          if (queryResult.data.length === 0) {
            throw new Error("No metrics found yet");
          }
          return queryResult;
        },
        { maxAttempts: 10, delayMs: 100 }
      );

      expect(data.length).toBeGreaterThan(0);
      const metric = data[0];
      // 2 errors out of 3 requests = 66.67% error rate (stored as 67 in percentage)
      expect(metric?.error_rate).toBeGreaterThanOrEqual(66);
      expect(metric?.error_rate).toBeLessThanOrEqual(67);
    })
  );

  it(
    "should group metrics by time window",
    withTransaction(async () => {
      const now = Date.now();
      const window1 = now;
      const window2 = now + 61000; // 61 seconds later (different window)

      const payload = {
        metrics: [
          {
            endpoint: "/api/v1/test",
            latency: 100,
            status: 200,
            timestamp: window1,
          },
          {
            endpoint: "/api/v1/test",
            latency: 150,
            status: 200,
            timestamp: window2,
          },
        ],
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.PROCESS_RAW_METRICS,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      const { data } = await metricsQuery.list({
        filters: { endpoint__eq: "/api/v1/test" },
        limit: 10,
      });

      // Should create 2 separate metrics (one for each window)
      expect(data.length).toBe(2);
    })
  );

  it(
    "should handle empty metrics array",
    withTransaction(async () => {
      const payload = {
        metrics: [],
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.PROCESS_RAW_METRICS,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      // Should not throw and should not create any metrics
      const { data } = await metricsQuery.list({
        limit: 10,
      });

      // No new metrics should be created
      expect(data.length).toBe(0);
    })
  );

  it(
    "should calculate percentiles correctly",
    withTransaction(async () => {
      const now = Date.now();
      const uniqueEndpoint = `/api/v1/percentile-test-${now}`;
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const payload = {
        metrics: latencies.map((latency, index) => ({
          endpoint: uniqueEndpoint,
          latency,
          status: 200,
          timestamp: now + index * 1000,
        })),
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.PROCESS_RAW_METRICS,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      // Retry query to handle CI timing issues
      const { data } = await retryUntil(
        async () => {
          const queryResult = await metricsQuery.list({
            filters: { endpoint__eq: uniqueEndpoint },
            limit: 1,
          });
          if (queryResult.data.length === 0) {
            throw new Error("No metrics found yet");
          }
          return queryResult;
        },
        { maxAttempts: 10, delayMs: 100 }
      );

      expect(data.length).toBeGreaterThan(0);
      const metric = data[0];
      // Verify we got the right metric
      expect(metric?.endpoint).toBe(uniqueEndpoint);
      expect(metric?.traffic_count).toBe(10);
      // P50 should be around 50, P95 around 95, P99 around 99
      expect(metric?.p50_latency).toBeGreaterThanOrEqual(40);
      expect(metric?.p50_latency).toBeLessThanOrEqual(60);
      expect(metric?.p95_latency).toBeGreaterThanOrEqual(90);
      expect(metric?.p99_latency).toBeGreaterThanOrEqual(95);
    })
  );
});
