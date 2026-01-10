// Browser-safe definitions export
// Only imports from definition.ts files (no Node.js dependencies)
import { definition as processRawMetricsDefinition } from "./processRawMetrics/definition";
import { definition as cleanupLogsDefinition } from "./cleanupLogs/definition";
import { definition as healthCheckDefinition } from "./healthCheck/definition";

export const jobDefinitions = {
  processRawMetrics: processRawMetricsDefinition,
  cleanupLogs: cleanupLogsDefinition,
  healthCheck: healthCheckDefinition,
} as const;
