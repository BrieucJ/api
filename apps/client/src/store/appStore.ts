import { create } from "zustand";
import type {
  LogSelectType,
  MetricsSelectType,
  SnapshotSelectType,
  ApiInfo,
  HealthStatus,
  WorkerStatsType,
  AvailableJobType,
} from "@shared/types";
import { client } from "@/lib/client";

// Limits for in-memory storage
const MAX_LOGS = 1000; // Keep last 1000 logs in memory
const MAX_METRICS = 500; // Keep last 500 metrics in memory

interface AppStore {
  logs: LogSelectType[];
  addLog: (log: LogSelectType) => void;
  initLogsPolling: () => () => void;
  _logsPollingStarted: boolean;
  metrics: MetricsSelectType[];
  addMetric: (metric: MetricsSelectType) => void;
  initMetricsPolling: () => () => void;
  _metricsPollingStarted: boolean;
  snapshots: SnapshotSelectType[];
  setSnapshots: (snapshots: SnapshotSelectType[]) => void;
  fetchSnapshots: (params?: {
    limit?: number;
    offset?: number;
    method?: string;
    path?: string;
    statusCode?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  replayRequest: (id: number) => Promise<any>;
  apiInfo: ApiInfo | null;
  setApiInfo: (info: ApiInfo) => void;
  initInfoPolling: () => () => void;
  _infoPollingStarted: boolean;
  healthStatus: HealthStatus | null;
  setHealthStatus: (status: HealthStatus) => void;
  initHealthPolling: () => () => void;
  _healthPollingStarted: boolean;
  workerStats: WorkerStatsType | null;
  setWorkerStats: (stats: WorkerStatsType | null) => void;
  initWorkerPolling: () => () => void;
  _workerPollingStarted: boolean;
}

export const useAppStore = create<AppStore>((set, get) => ({
  logs: [],
  _logsPollingStarted: false,
  metrics: [],
  _metricsPollingStarted: false,
  snapshots: [],
  apiInfo: null,
  _infoPollingStarted: false,
  healthStatus: null,
  _healthPollingStarted: false,
  workerStats: null,
  _workerPollingStarted: false,
  addLog: (log) =>
    set((state) => {
      if (state.logs.find((l) => l.id === log.id)) return state;
      // Prepend new log to keep newest first
      const newLogs = [log, ...state.logs];
      // Keep only first MAX_LOGS entries (newest ones)
      const limitedLogs = newLogs.slice(0, MAX_LOGS);
      return { logs: limitedLogs };
    }),
  addMetric: (metric) =>
    set((state) => {
      if (state.metrics.find((m) => m.id === metric.id)) return state;

      // Prepend new metric to keep newest first
      const newMetrics = [metric, ...state.metrics];
      // Keep only first MAX_METRICS entries (newest ones)
      const limitedMetrics = newMetrics.slice(0, MAX_METRICS);
      return { metrics: limitedMetrics };
    }),
  setSnapshots: (snapshots) => set({ snapshots }),
  fetchSnapshots: async (params = {}) => {
    try {
      const {
        limit = 50,
        offset = 0,
        method,
        path,
        statusCode,
        startDate,
        endDate,
      } = params;
      const query: Record<string, string> = {
        limit: limit.toString(),
        offset: offset.toString(),
      };
      if (method) query.method = method;
      if (path) query.path = path;
      if (statusCode !== undefined) query.statusCode = statusCode.toString();
      if (startDate) query.startDate = startDate;
      if (endDate) query.endDate = endDate;

      // Type assertion needed because AppType union doesn't properly expose all routes
      const response = await (client as any).replay.$get({ query });
      if (response.ok) {
        const data = (await response.json()) as { data?: SnapshotSelectType[] };
        if (data.data) {
          get().setSnapshots(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch snapshots:", error);
    }
  },
  replayRequest: async (id: number) => {
    try {
      const idStr = id.toString();
      // Hono client doesn't properly type parameterized routes, so we use type assertion
      const replayClient = (client as any).replay;
      const response = await replayClient[idStr].replay.$post({
        param: { id: idStr },
      });
      if (response.ok) {
        const data = (await response.json()) as { data?: any };
        return data.data;
      } else {
        const error = (await response.json()) as {
          error?: { message?: string };
        };
        throw new Error(error.error?.message || "Replay failed");
      }
    } catch (error) {
      console.error("Failed to replay request:", error);
      throw error;
    }
  },
  setApiInfo: (info) => set({ apiInfo: info }),
  setHealthStatus: (status) => set({ healthStatus: status }),
  setWorkerStats: (stats) => set({ workerStats: stats }),
  initLogsPolling: () => {
    if (get()._logsPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _logsPollingStarted: true });

    let lastId = 0;
    let isInitialLoad = true;

    const fetchLogs = async () => {
      try {
        const query: Record<string, string> = {
          order_by: "id",
          order: isInitialLoad ? "desc" : "asc",
        };

        if (isInitialLoad) {
          // Initial load: fetch last 50 logs
          query.limit = "50";
          query.offset = "0";
        } else {
          // Subsequent polls: fetch only new logs
          query.limit = "1000";
          query.offset = "0";
          if (lastId > 0) {
            query.id__gt = lastId.toString();
          }
        }

        console.log(
          "[LogsPolling] Fetching with query:",
          query,
          "lastId:",
          lastId,
          "isInitialLoad:",
          isInitialLoad
        );
        const response = await (client as any).logs.$get({ query });
        if (response.ok) {
          const data = (await response.json()) as { data?: LogSelectType[] };
          console.log(
            "[LogsPolling] Received",
            data.data?.length || 0,
            "logs",
            data.data
          );
          if (data.data && data.data.length > 0) {
            for (const log of data.data) {
              lastId = Math.max(lastId, log.id);
              get().addLog(log);
            }
            console.log(
              "[LogsPolling] After adding, total logs in store:",
              get().logs.length,
              "lastId:",
              lastId
            );

            if (isInitialLoad) {
              isInitialLoad = false;
            }
          }
        } else {
          console.error("[LogsPolling] Response not OK:", response.status);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    // Fetch immediately
    fetchLogs();

    // Then poll every 2 seconds
    const intervalId = setInterval(fetchLogs, 2000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      set({ _logsPollingStarted: false });
    };
  },
  initMetricsPolling: () => {
    if (get()._metricsPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _metricsPollingStarted: true });

    let lastId = 0;
    let isInitialLoad = true;

    const fetchMetrics = async () => {
      try {
        const query: Record<string, string> = {
          order_by: "id",
          order: isInitialLoad ? "desc" : "asc",
        };

        if (isInitialLoad) {
          // Initial load: fetch last 50 metrics
          query.limit = "50";
          query.offset = "0";
        } else {
          // Subsequent polls: fetch only new metrics
          query.limit = "1000";
          query.offset = "0";
          if (lastId > 0) {
            query.id__gt = lastId.toString();
          }
        }

        const response = await (client as any).metrics.$get({ query });
        if (response.ok) {
          const data = (await response.json()) as {
            data?: MetricsSelectType[];
          };
          if (data.data && data.data.length > 0) {
            for (const metric of data.data) {
              lastId = Math.max(lastId, metric.id);
              get().addMetric(metric);
            }

            if (isInitialLoad) {
              isInitialLoad = false;
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      }
    };

    // Fetch immediately
    fetchMetrics();

    // Then poll every 2 seconds
    const intervalId = setInterval(fetchMetrics, 2000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      set({ _metricsPollingStarted: false });
    };
  },
  initInfoPolling: () => {
    if (get()._infoPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _infoPollingStarted: true });

    const fetchInfo = async () => {
      try {
        const response = await client.info.$get({});
        if (response.ok) {
          const data = (await response.json()) as { data?: ApiInfo };
          if (data.data) {
            get().setApiInfo(data.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch API info:", error);
      }
    };

    // Fetch immediately
    fetchInfo();

    // Then poll every 5 seconds
    const intervalId = setInterval(fetchInfo, 5000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      set({ _infoPollingStarted: false });
    };
  },
  initHealthPolling: () => {
    if (get()._healthPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _healthPollingStarted: true });

    const fetchHealth = async () => {
      try {
        const response = await client.health.$get({});
        if (response.ok) {
          const data = (await response.json()) as { data?: HealthStatus };
          if (data.data) {
            get().setHealthStatus(data.data);
          }
        } else {
          // If health check fails, mark as unhealthy
          get().setHealthStatus({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            uptime: 0,
            database: {
              status: "unhealthy",
              responseTime: 0,
              connected: false,
              error: "Health check failed",
            },
            worker: {
              status: "unknown",
              error: "Health check failed",
            },
          } as any);
        }
      } catch (error) {
        console.error("Failed to fetch health status:", error);
        // On error, mark as unhealthy
        get().setHealthStatus({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          uptime: 0,
          database: {
            status: "unhealthy",
            responseTime: 0,
            connected: false,
            error: "Failed to connect",
          },
          worker: {
            status: "unknown",
            error: "Failed to connect",
          },
        } as any);
      }
    };

    // Fetch immediately
    fetchHealth();

    // Then poll every 5 seconds
    const intervalId = setInterval(fetchHealth, 5000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      set({ _healthPollingStarted: false });
    };
  },
  initWorkerPolling: () => {
    if (get()._workerPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _workerPollingStarted: true });

    const fetchWorkerStats = async () => {
      try {
        const response = await (client as any).worker.stats.$get({});
        if (response.ok) {
          const result = (await response.json()) as {
            data?: WorkerStatsType[];
          };
          // Extract first item from array (or null if empty)
          get().setWorkerStats(result.data?.[0] || null);
        }
      } catch (error) {
        console.error("Failed to fetch worker stats:", error);
        get().setWorkerStats(null);
      }
    };

    // Fetch immediately
    fetchWorkerStats();

    // Then poll every 5 seconds
    const intervalId = setInterval(() => {
      fetchWorkerStats();
    }, 5000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      set({ _workerPollingStarted: false });
    };
  },
}));
