import { QueryBuilder } from "./querybuilder";
import { users } from "./models/users";
import { logs } from "./models/logs";
import { metrics } from "./models/metrics";
import { requestSnapshots } from "./models/requestSnapshots";
import { workerStats } from "./models/workerStats";
import { refreshTokens } from "./models/refreshTokens";

// Centralized query builder instances with table-specific configurations
export const userQuery = new QueryBuilder(users, {
  excludeColumns: ["password_hash", "deleted_at"], // Users need password_hash excluded
  queryLogger: { enabled: true, slowQueryThreshold: 500 },
});

export const logQuery = new QueryBuilder(logs, {
  excludeColumns: ["deleted_at"], // Logs might not have soft delete
  queryLogger: { enabled: true, slowQueryThreshold: 1000 },
});

export const metricsQuery = new QueryBuilder(metrics, {
  excludeColumns: ["deleted_at"],
  queryLogger: { enabled: true, slowQueryThreshold: 1000 },
});

export const requestSnapshotQuery = new QueryBuilder(requestSnapshots, {
  excludeColumns: ["deleted_at"],
  queryLogger: { enabled: true, slowQueryThreshold: 2000 }, // Snapshots might be slower
});

export const workerStatsQuery = new QueryBuilder(workerStats, {
  excludeColumns: ["deleted_at"],
  queryLogger: { enabled: true, slowQueryThreshold: 1000 },
});

export const refreshTokenQuery = new QueryBuilder(refreshTokens, {
  excludeColumns: ["deleted_at"],
  queryLogger: { enabled: true, slowQueryThreshold: 500 },
});
