export interface AdminModelConfig {
  name: string;
  displayName: string;
  pluralName: string;
  basePath: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const adminModels: AdminModelConfig[] = [
  {
    name: "users",
    displayName: "User",
    pluralName: "Users",
    basePath: "/api/v1/users",
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    name: "logs",
    displayName: "Log",
    pluralName: "Logs",
    basePath: "/logs",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    name: "metrics",
    displayName: "Metric",
    pluralName: "Metrics",
    basePath: "/metrics",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    name: "request_snapshots",
    displayName: "Request Snapshot",
    pluralName: "Request Snapshots",
    basePath: "/replay",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  {
    name: "refresh_tokens",
    displayName: "Refresh Token",
    pluralName: "Refresh Tokens",
    basePath: "/api/v1/refresh_tokens",
    canCreate: false,
    canEdit: false,
    canDelete: true,
  },
  {
    name: "worker_stats",
    displayName: "Worker Stat",
    pluralName: "Worker Stats",
    basePath: "/worker/stats",
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
];

export function getAdminModel(name: string): AdminModelConfig | undefined {
  return adminModels.find((m) => m.name === name);
}
