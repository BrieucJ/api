// Auto-discovery registry - imports all jobs
import * as processRawMetrics from "./processRawMetrics";
import * as cleanupLogs from "./cleanupLogs";
import * as healthCheck from "./healthCheck";
import type { JobType, JobHandler, JobDefinition, JobMetadata } from "./types";

// Export all jobs
export const jobs = {
  processRawMetrics,
  cleanupLogs,
  healthCheck,
} as const;

// Auto-build registry
const jobRegistry = new Map<
  JobType,
  { handler: JobHandler; definition: JobDefinition }
>();

// Register all jobs
Object.values(jobs).forEach((job) => {
  jobRegistry.set(job.definition.type, {
    handler: job.handler as JobHandler, // Type assertion needed due to specific payload types
    definition: job.definition,
  });
});

export function getJobHandler<T extends JobType>(
  jobType: T
): JobHandler | undefined {
  return jobRegistry.get(jobType)?.handler;
}

export function hasJobHandler(jobType: JobType): boolean {
  return jobRegistry.has(jobType);
}

export function getJobDefinition(jobType: JobType): JobDefinition | undefined {
  return jobRegistry.get(jobType)?.definition;
}

export function getJobMetadata(jobType: JobType): JobMetadata | undefined {
  const definition = jobRegistry.get(jobType)?.definition;
  if (!definition) return undefined;

  // Extract metadata (without cron config)
  const { cron, ...metadata } = definition;
  return metadata;
}

export function getAllJobs(): JobMetadata[] {
  return Array.from(jobRegistry.values()).map(({ definition }) => {
    const { cron, ...metadata } = definition;
    return metadata;
  });
}

export function getAllCronJobs() {
  return Array.from(jobRegistry.values())
    .filter((job) => job.definition.cron?.enabled)
    .map((job) => ({
      cronExpression: job.definition.cron!.expression,
      jobType: job.definition.type,
      payload: job.definition.cron!.defaultPayload,
      enabled: true,
    }));
}
