import { describe, it, expect, beforeEach } from "bun:test";
import { processRawMetrics } from "@/jobs/handlers/processRawMetrics";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { withTransaction } from "@/tests/helpers/test-helpers";
import { metrics } from "@shared/db";
import { createQueryBuilder } from "@shared/db";

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

      await processRawMetrics(payload);

      // Check if metrics were created
      const { data } = await metricsQuery.list({
        filters: { endpoint__eq: "/api/v1/users" },
        limit: 10,
      });

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

      await processRawMetrics(payload);

      const { data } = await metricsQuery.list({
        filters: { endpoint__eq: "/api/v1/test" },
        limit: 1,
      });

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

      await processRawMetrics(payload);

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

      await processRawMetrics(payload);

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
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const payload = {
        metrics: latencies.map((latency, index) => ({
          endpoint: "/api/v1/test",
          latency,
          status: 200,
          timestamp: now + index * 1000,
        })),
      };

      await processRawMetrics(payload);

      const { data } = await metricsQuery.list({
        filters: { endpoint__eq: "/api/v1/test" },
        limit: 1,
      });

      expect(data.length).toBeGreaterThan(0);
      const metric = data[0];
      // P50 should be around 50, P95 around 95, P99 around 99
      expect(metric?.p50_latency).toBeGreaterThanOrEqual(40);
      expect(metric?.p50_latency).toBeLessThanOrEqual(60);
      expect(metric?.p95_latency).toBeGreaterThanOrEqual(90);
      expect(metric?.p99_latency).toBeGreaterThanOrEqual(95);
    })
  );
});
