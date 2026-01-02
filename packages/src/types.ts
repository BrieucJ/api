import { z } from "zod";
import { logSelectSchema } from "@backend/db/models/logs";
import { metricsSelectSchema } from "@backend/db/models/metrics";
import { snapshotSelectSchema } from "@backend/db/models/requestSnapshots";
import { infoResponseSchema } from "@backend/api/routes/private/info/info.routes";
import { healthResponseSchema } from "@backend/api/routes/private/health/health.routes";
import {
  workerStatsSelectSchema,
  scheduledJobSchema,
  availableJobSchema,
} from "@backend/db/models/workerStats";
export type { AppType } from "@backend/api/index";
export type LogSelectType = z.infer<typeof logSelectSchema>;
export type MetricsSelectType = z.infer<typeof metricsSelectSchema>;
export type SnapshotSelectType = z.infer<typeof snapshotSelectSchema>;
export type ApiInfo = z.infer<typeof infoResponseSchema>;
export type HealthStatus = z.infer<typeof healthResponseSchema>;
export type WorkerStatsType = z.infer<typeof workerStatsSelectSchema>;
export type ScheduledJobType = z.infer<typeof scheduledJobSchema>;
export type AvailableJobType = z.infer<typeof availableJobSchema>;

// Raw metric data structure for worker processing
export interface RawMetric {
  endpoint: string;
  latency: number;
  status: number;
  timestamp: number; // Unix timestamp in milliseconds
  requestSize?: number;
  responseSize?: number;
}
