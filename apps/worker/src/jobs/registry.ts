import { JobType, type JobHandler, type JobMetadata } from "./types";
import type {
  ProcessMetricsPayload,
  ProcessRawMetricsPayload,
  CleanupLogsPayload,
  HealthCheckPayload,
} from "./types";
import {
  processMetricsPayloadSchema,
  processRawMetricsPayloadSchema,
  cleanupLogsPayloadSchema,
  healthCheckPayloadSchema,
} from "./types";
import { processMetrics } from "./handlers/processMetrics";
import { processRawMetrics } from "./handlers/processRawMetrics";
import { cleanupLogs } from "./handlers/cleanupLogs";
import { healthCheck } from "./handlers/healthCheck";

type JobHandlerMap = {
  [JobType.PROCESS_METRICS]: JobHandler<ProcessMetricsPayload>;
  [JobType.PROCESS_RAW_METRICS]: JobHandler<ProcessRawMetricsPayload>;
  [JobType.CLEANUP_LOGS]: JobHandler<CleanupLogsPayload>;
  [JobType.HEALTH_CHECK]: JobHandler<HealthCheckPayload>;
};

const handlers: JobHandlerMap = {
  [JobType.PROCESS_METRICS]: processMetrics,
  [JobType.PROCESS_RAW_METRICS]: processRawMetrics,
  [JobType.CLEANUP_LOGS]: cleanupLogs,
  [JobType.HEALTH_CHECK]: healthCheck,
};

export function getJobHandler<T extends JobType>(
  jobType: T
): JobHandlerMap[T] | undefined {
  return handlers[jobType] as JobHandlerMap[T] | undefined;
}

export function hasJobHandler(jobType: JobType): boolean {
  return jobType in handlers;
}

const jobMetadata: Record<JobType, JobMetadata> = {
  [JobType.PROCESS_METRICS]: {
    type: JobType.PROCESS_METRICS,
    name: "Process Metrics",
    description: "Aggregates raw metrics data into time windows",
    category: "metrics",
    payloadSchema: processMetricsPayloadSchema,
    defaultOptions: {
      maxAttempts: 3,
    },
    settings: {
      windowSizeSeconds: 60,
    },
  },
  [JobType.PROCESS_RAW_METRICS]: {
    type: JobType.PROCESS_RAW_METRICS,
    name: "Process Raw Metrics",
    description: "Processes raw metrics and aggregates them into time windows",
    category: "metrics",
    payloadSchema: processRawMetricsPayloadSchema,
    defaultOptions: {
      maxAttempts: 3,
    },
    settings: {
      windowSizeSeconds: 60,
    },
  },
  [JobType.CLEANUP_LOGS]: {
    type: JobType.CLEANUP_LOGS,
    name: "Cleanup Logs",
    description: "Removes old log entries based on retention policy",
    category: "maintenance",
    payloadSchema: cleanupLogsPayloadSchema,
    defaultOptions: {
      maxAttempts: 3,
    },
    settings: {
      defaultOlderThanDays: 30,
      defaultBatchSize: 1000,
    },
  },
  [JobType.HEALTH_CHECK]: {
    type: JobType.HEALTH_CHECK,
    name: "Health Check",
    description: "Performs health checks on database, queue, and scheduler",
    category: "monitoring",
    payloadSchema: healthCheckPayloadSchema,
    defaultOptions: {
      maxAttempts: 1,
    },
    settings: {},
  },
};

export function getJobMetadata(jobType: JobType): JobMetadata | undefined {
  return jobMetadata[jobType];
}

export function getAllJobs(): JobMetadata[] {
  return Object.values(jobMetadata);
}
