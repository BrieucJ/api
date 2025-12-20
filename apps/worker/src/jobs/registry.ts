import { JobType, type JobHandler } from "./types";
import type {
  ProcessMetricsPayload,
  CleanupLogsPayload,
  HealthCheckPayload,
} from "./types";
import { processMetrics } from "./handlers/processMetrics";
import { cleanupLogs } from "./handlers/cleanupLogs";
import { healthCheck } from "./handlers/healthCheck";

type JobHandlerMap = {
  [JobType.PROCESS_METRICS]: JobHandler<ProcessMetricsPayload>;
  [JobType.CLEANUP_LOGS]: JobHandler<CleanupLogsPayload>;
  [JobType.HEALTH_CHECK]: JobHandler<HealthCheckPayload>;
};

const handlers: JobHandlerMap = {
  [JobType.PROCESS_METRICS]: processMetrics,
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
