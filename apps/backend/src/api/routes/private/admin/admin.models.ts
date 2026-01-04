import * as models from "@/db/models";

export interface ModelMetadata {
  name: string;
  displayName: string;
  pluralName: string;
  basePath: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const modelMap: Record<string, any> = {
  users: models.users,
  logs: models.logs,
  metrics: models.metrics,
  request_snapshots: models.requestSnapshots,
  refresh_tokens: models.refreshTokens,
  worker_stats: models.workerStats,
};

export const modelMetadata: Record<string, ModelMetadata> = {
  users: {
    name: "users",
    displayName: "User",
    pluralName: "Users",
    basePath: "/api/v1/users",
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  logs: {
    name: "logs",
    displayName: "Log",
    pluralName: "Logs",
    basePath: "/logs",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  metrics: {
    name: "metrics",
    displayName: "Metric",
    pluralName: "Metrics",
    basePath: "/metrics",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  request_snapshots: {
    name: "request_snapshots",
    displayName: "Request Snapshot",
    pluralName: "Request Snapshots",
    basePath: "/replay",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  refresh_tokens: {
    name: "refresh_tokens",
    displayName: "Refresh Token",
    pluralName: "Refresh Tokens",
    basePath: "/api/v1/refresh_tokens",
    canCreate: false,
    canEdit: false,
    canDelete: true,
  },
  worker_stats: {
    name: "worker_stats",
    displayName: "Worker Stat",
    pluralName: "Worker Stats",
    basePath: "/worker/stats",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
};

export function getModelTable(name: string) {
  return modelMap[name];
}

export function getModelMetadata(name: string): ModelMetadata | undefined {
  return modelMetadata[name];
}
