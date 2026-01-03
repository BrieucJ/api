import { describe, it, expect } from "bun:test";
import {
  getJobHandler,
  hasJobHandler,
  getJobMetadata,
  getAllJobs,
} from "@/jobs/registry";
import { JobType } from "@/jobs/types";

describe("Job Registry", () => {
  describe("getJobHandler", () => {
    it("should return handler for PROCESS_RAW_METRICS", () => {
      const handler = getJobHandler(JobType.PROCESS_RAW_METRICS);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should return handler for PROCESS_METRICS", () => {
      const handler = getJobHandler(JobType.PROCESS_METRICS);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should return handler for CLEANUP_LOGS", () => {
      const handler = getJobHandler(JobType.CLEANUP_LOGS);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should return handler for HEALTH_CHECK", () => {
      const handler = getJobHandler(JobType.HEALTH_CHECK);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });
  });

  describe("hasJobHandler", () => {
    it("should return true for valid job types", () => {
      expect(hasJobHandler(JobType.PROCESS_RAW_METRICS)).toBe(true);
      expect(hasJobHandler(JobType.PROCESS_METRICS)).toBe(true);
      expect(hasJobHandler(JobType.CLEANUP_LOGS)).toBe(true);
      expect(hasJobHandler(JobType.HEALTH_CHECK)).toBe(true);
    });

    it("should return false for invalid job types", () => {
      expect(hasJobHandler("INVALID_TYPE" as JobType)).toBe(false);
    });
  });

  describe("getJobMetadata", () => {
    it("should return metadata for PROCESS_RAW_METRICS", () => {
      const metadata = getJobMetadata(JobType.PROCESS_RAW_METRICS);
      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe(JobType.PROCESS_RAW_METRICS);
      expect(metadata?.name).toBeDefined();
      expect(metadata?.description).toBeDefined();
      expect(metadata?.payloadSchema).toBeDefined();
    });

    it("should return metadata for all job types", () => {
      const allTypes = [
        JobType.PROCESS_RAW_METRICS,
        JobType.PROCESS_METRICS,
        JobType.CLEANUP_LOGS,
        JobType.HEALTH_CHECK,
      ];

      for (const type of allTypes) {
        const metadata = getJobMetadata(type);
        expect(metadata).toBeDefined();
        expect(metadata?.type).toBe(type);
      }
    });

    it("should return undefined for invalid job type", () => {
      const metadata = getJobMetadata("INVALID_TYPE" as JobType);
      expect(metadata).toBeUndefined();
    });
  });

  describe("getAllJobs", () => {
    it("should return all job metadata", () => {
      const jobs = getAllJobs();
      expect(jobs).toBeInstanceOf(Array);
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.length).toBe(4); // All 4 job types
    });

    it("should include all required fields in metadata", () => {
      const jobs = getAllJobs();
      for (const job of jobs) {
        expect(job.type).toBeDefined();
        expect(job.name).toBeDefined();
        expect(job.description).toBeDefined();
        expect(job.payloadSchema).toBeDefined();
        expect(job.defaultOptions).toBeDefined();
      }
    });
  });
});
