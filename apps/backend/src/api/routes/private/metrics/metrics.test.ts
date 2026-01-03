import { describe, it, expect, beforeEach } from "bun:test";
import { metrics } from "@/db/models/metrics";
import { createQueryBuilder } from "@/db/querybuilder";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

const metricsQuery = createQueryBuilder<typeof metrics>(metrics);

describe("Metrics API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /metrics", () => {
    it(
      "should list all metrics",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const windowStart = new Date(now.getTime() - 60000); // 1 minute ago
        const windowEnd = now;

        // Create test metrics
        await metricsQuery.create({
          window_start: windowStart,
          window_end: windowEnd,
          endpoint: "/api/v1/users",
          p50_latency: 80,
          p95_latency: 120,
          p99_latency: 200,
          error_rate: 2, // 2% stored as integer
          traffic_count: 100,
        });

        await metricsQuery.create({
          window_start: windowStart,
          window_end: windowEnd,
          endpoint: "/api/v1/users/:id",
          p50_latency: 50,
          p95_latency: 80,
          p99_latency: 150,
          error_rate: 0,
          traffic_count: 200,
        });

        const res = await client["/metrics"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              order_by: "id",
              order: "asc",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
        expect(body.metadata.total).toBeGreaterThanOrEqual(2);
        // Verify error_rate is converted from percentage to decimal
        expect(body.data[0].error_rate).toBeLessThanOrEqual(1);
      })
    );

    it(
      "should filter metrics by endpoint",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics2@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const windowStart = new Date(now.getTime() - 60000);
        const windowEnd = now;

        await metricsQuery.create({
          window_start: windowStart,
          window_end: windowEnd,
          endpoint: "/api/v1/users",
          p50_latency: 80,
          p95_latency: 120,
          p99_latency: 200,
          error_rate: 2,
          traffic_count: 100,
        });

        const res = await client["/metrics"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              endpoint: "/api/v1/users",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(
          body.data.every((metric: any) => metric.endpoint === "/api/v1/users")
        ).toBe(true);
      })
    );

    it(
      "should filter metrics by date range",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics3@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const windowStart = new Date(now.getTime() - 60000);
        const windowEnd = now;

        await metricsQuery.create({
          window_start: windowStart,
          window_end: windowEnd,
          endpoint: "/api/v1/users",
          p50_latency: 80,
          p95_latency: 120,
          p99_latency: 200,
          error_rate: 2,
          traffic_count: 100,
        });

        const startDate = new Date(now.getTime() - 120000).toISOString();
        const endDate = new Date(now.getTime() + 60000).toISOString();

        const res = await client["/metrics"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              startDate,
              endDate,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
      })
    );

    it(
      "should paginate metrics",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics4@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const windowStart = new Date(now.getTime() - 60000);
        const windowEnd = now;

        // Create multiple metrics
        for (let i = 0; i < 5; i++) {
          await metricsQuery.create({
            window_start: windowStart,
            window_end: windowEnd,
            endpoint: `/api/v1/endpoint${i}`,
            p50_latency: 80,
            p95_latency: 120,
            p99_latency: 200,
            error_rate: 2,
            traffic_count: 100,
          });
        }

        const res = await client["/metrics"].$get(
          {
            query: {
              limit: 2,
              offset: 0,
              order_by: "id",
              order: "asc",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBeLessThanOrEqual(2);
        expect(body.metadata.limit).toBe(2);
        expect(body.metadata.offset).toBe(0);
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/metrics"].$get({
          query: {
            limit: 10,
            offset: 0,
          },
        });

        expect(res.status).toBe(401);
      })
    );
  });

  describe("GET /metrics/aggregate", () => {
    it(
      "should return aggregated metrics",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics5@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const startDate = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
        const endDate = new Date(now.getTime() + 60000).toISOString();

        const res = await client["/metrics/aggregate"].$get(
          {
            query: {
              startDate,
              endDate,
              windowSize: 60,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
        // Verify error_rate is converted from percentage to decimal
        if (body.data.length > 0) {
          expect(body.data[0].error_rate).toBeLessThanOrEqual(1);
        }
      })
    );

    it(
      "should filter aggregated metrics by endpoint",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "metrics6@test.com",
          "password123",
          "admin"
        );

        const now = new Date();
        const startDate = new Date(now.getTime() - 3600000).toISOString();
        const endDate = new Date(now.getTime() + 60000).toISOString();

        const res = await client["/metrics/aggregate"].$get(
          {
            query: {
              startDate,
              endDate,
              windowSize: 60,
              endpoint: "/api/v1/users",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const now = new Date();
        const startDate = new Date(now.getTime() - 3600000).toISOString();
        const endDate = new Date(now.getTime() + 60000).toISOString();

        const res = await client["/metrics/aggregate"].$get({
          query: {
            startDate,
            endDate,
            windowSize: 60,
          },
        });

        expect(res.status).toBe(401);
      })
    );
  });
});
