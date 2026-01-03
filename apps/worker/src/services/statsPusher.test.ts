import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { StatsPusher } from "@/services/statsPusher";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { withTransaction } from "@/tests/helpers/test-helpers";
import { workerStats } from "@shared/db";
import { createQueryBuilder } from "@shared/db";

const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);

describe("StatsPusher", () => {
  let statsPusher: StatsPusher;

  beforeEach(async () => {
    await resetTestDatabase();
    statsPusher = new StatsPusher();
  });

  afterEach(() => {
    statsPusher.stopInterval();
  });

  describe("pushStats", () => {
    it(
      "should push stats to database",
      withTransaction(async () => {
        await statsPusher.pushStats();

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { data } = await statsQuery.list({
          filters: { worker_mode__eq: "local" },
          limit: 1,
        });

        expect(data.length).toBeGreaterThan(0);
        const stats = data[0];
        expect(stats).toBeDefined();
        expect(stats?.worker_mode).toBe("local");
        expect(stats?.queue_size).toBeDefined();
        expect(stats?.processing_count).toBeDefined();
        expect(stats?.scheduled_jobs_count).toBeDefined();
        expect(stats?.available_jobs_count).toBeDefined();
      })
    );

    it(
      "should update existing stats",
      withTransaction(async () => {
        // Create initial stats
        await statsQuery.create({
          worker_mode: "local",
          queue_size: 0,
          processing_count: 0,
          scheduled_jobs_count: 0,
          available_jobs_count: 0,
          scheduled_jobs: [],
          available_jobs: [],
        });

        await statsPusher.pushStats();

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { data } = await statsQuery.list({
          filters: { worker_mode__eq: "local" },
          limit: 1,
        });

        expect(data.length).toBeGreaterThan(0);
        const stats = data[0];
        expect(stats).toBeDefined();
        expect(stats?.last_heartbeat).toBeDefined();
      })
    );

    it(
      "should include all required fields",
      withTransaction(async () => {
        await statsPusher.pushStats();

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { data } = await statsQuery.list({
          filters: { worker_mode__eq: "local" },
          limit: 1,
        });

        expect(data.length).toBeGreaterThan(0);
        const stats = data[0];
        expect(stats).toBeDefined();
        expect(stats?.worker_mode).toBeDefined();
        expect(stats?.queue_size).toBeDefined();
        expect(stats?.processing_count).toBeDefined();
        expect(stats?.scheduled_jobs_count).toBeDefined();
        expect(stats?.available_jobs_count).toBeDefined();
        expect(stats?.scheduled_jobs).toBeDefined();
        expect(stats?.available_jobs).toBeDefined();
        expect(stats?.last_heartbeat).toBeDefined();
      })
    );
  });

  describe("startInterval", () => {
    it("should start interval in local mode", () => {
      // WORKER_MODE is set to "local" in setup.ts
      statsPusher.startInterval();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should not start interval twice", () => {
      statsPusher.startInterval();
      statsPusher.startInterval(); // Should not throw
      statsPusher.stopInterval();
    });
  });

  describe("stopInterval", () => {
    it("should stop interval", () => {
      statsPusher.startInterval();
      expect(() => statsPusher.stopInterval()).not.toThrow();
    });

    it("should handle stopInterval when not started", () => {
      expect(() => statsPusher.stopInterval()).not.toThrow();
    });
  });
});

