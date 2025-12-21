import { create } from "zustand";
import type {
  LogSelectType,
  MetricsSelectType,
  SnapshotSelectType,
  ApiInfo,
  HealthStatus,
} from "@shared/types";
import type { WorkerStats, JobMetadata } from "@/lib/types";
import { client } from "@/lib/client";
import config from "@/lib/config";

// Throttle constants
const LOGS_THROTTLE_MS = 300; // Update logs at most ~3 times per second
const METRICS_THROTTLE_MS = 500; // Update metrics at most 2 times per second
const MAX_LOGS = 1000; // Keep last 1000 logs in memory
const MAX_METRICS = 500; // Keep last 500 metrics in memory

interface AppStore {
  logs: LogSelectType[];
  addLog: (log: LogSelectType) => void;
  initLogsSSE: () => void;
  _sseStarted: boolean;
  _logsLastUpdate: number;
  _logsPendingUpdate: LogSelectType | null;
  _logsThrottleTimer: ReturnType<typeof setTimeout> | null;
  metrics: MetricsSelectType[];
  addMetric: (metric: MetricsSelectType) => void;
  initMetricsSSE: () => void;
  _metricsSseStarted: boolean;
  _metricsLastUpdate: number;
  _metricsPendingUpdate: MetricsSelectType | null;
  _metricsThrottleTimer: ReturnType<typeof setTimeout> | null;
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
  workerStats: WorkerStats | null;
  setWorkerStats: (stats: WorkerStats) => void;
  initWorkerPolling: () => () => void;
  _workerPollingStarted: boolean;
  availableJobs: JobMetadata[];
  setAvailableJobs: (jobs: JobMetadata[]) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  logs: [],
  _sseStarted: false,
  _logsLastUpdate: 0,
  _logsPendingUpdate: null,
  _logsThrottleTimer: null,
  metrics: [],
  _metricsSseStarted: false,
  _metricsLastUpdate: 0,
  _metricsPendingUpdate: null,
  _metricsThrottleTimer: null,
  snapshots: [],
  apiInfo: null,
  _infoPollingStarted: false,
  healthStatus: null,
  _healthPollingStarted: false,
  workerStats: null,
  _workerPollingStarted: false,
  availableJobs: [],
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
  setAvailableJobs: (jobs) => set({ availableJobs: jobs }),
  initLogsSSE: () => {
    if (get()._sseStarted) return;
    set({ _sseStarted: true });

    const eventSource = new EventSource(`${config.BACKEND_URL}/logs/stream`);
    let initialBatchReceived = false;
    let initialBatchCount = 0;
    const INITIAL_BATCH_SIZE = 50; // Expected initial batch size

    // Mark initial batch as received after a timeout if we don't get enough logs
    // This handles cases where there are fewer logs in the database
    const initialBatchTimeout = setTimeout(() => {
      if (!initialBatchReceived) {
        initialBatchReceived = true;
      }
    }, 2000); // 2 second timeout

    const processLogUpdate = (
      newLog: LogSelectType,
      isInitialBatch = false
    ) => {
      // For initial batch, process immediately without throttling
      if (isInitialBatch) {
        get().addLog(newLog);
        initialBatchCount++;
        if (initialBatchCount >= INITIAL_BATCH_SIZE) {
          clearTimeout(initialBatchTimeout);
          initialBatchReceived = true;
        }
        return;
      }

      // For subsequent updates, use throttling
      const now = Date.now();
      const state = get();

      // If enough time has passed, update immediately
      if (now - state._logsLastUpdate >= LOGS_THROTTLE_MS) {
        // Clear any pending timer
        if (state._logsThrottleTimer) {
          clearTimeout(state._logsThrottleTimer);
        }
        set({
          _logsLastUpdate: now,
          _logsPendingUpdate: null,
          _logsThrottleTimer: null,
        });
        get().addLog(newLog);
      } else {
        // Queue the update
        set({ _logsPendingUpdate: newLog });

        // Schedule update if not already scheduled
        if (!state._logsThrottleTimer) {
          const delay = LOGS_THROTTLE_MS - (now - state._logsLastUpdate);
          const timer = setTimeout(() => {
            const pending = get()._logsPendingUpdate;
            if (pending) {
              set({
                _logsLastUpdate: Date.now(),
                _logsPendingUpdate: null,
                _logsThrottleTimer: null,
              });
              get().addLog(pending);
            }
          }, delay);
          set({ _logsThrottleTimer: timer });
        }
      }
    };

    eventSource.addEventListener("log-update", (event: MessageEvent) => {
      try {
        const newLog: LogSelectType = JSON.parse(event.data);
        processLogUpdate(newLog, !initialBatchReceived);
      } catch (error) {
        console.error("Error parsing log update:", error, event.data);
      }
    });

    // Fallback message listener (in case events come without event type)
    eventSource.addEventListener("message", (event: MessageEvent) => {
      try {
        const newLog: LogSelectType = JSON.parse(event.data);
        processLogUpdate(newLog, !initialBatchReceived);
      } catch (error) {
        console.error("Error parsing log message:", error, event.data);
      }
    });

    eventSource.addEventListener("error", (error) => {
      console.error("Logs SSE connection error:", error);
      // EventSource.CONNECTING = 0, EventSource.OPEN = 1, EventSource.CLOSED = 2
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("Logs SSE connection closed");
      }
    });

    // Store eventSource reference for cleanup if needed
    (eventSource as any)._storeRef = eventSource;
  },
  initMetricsSSE: () => {
    if (get()._metricsSseStarted) return;
    set({ _metricsSseStarted: true });

    const eventSource = new EventSource(`${config.BACKEND_URL}/metrics/stream`);
    let initialBatchReceived = false;
    let initialBatchCount = 0;
    const INITIAL_BATCH_SIZE = 50; // Expected initial batch size

    // Mark initial batch as received after a timeout if we don't get enough metrics
    // This handles cases where there are fewer metrics in the database
    const initialBatchTimeout = setTimeout(() => {
      if (!initialBatchReceived) {
        initialBatchReceived = true;
      }
    }, 2000); // 2 second timeout

    const processMetricUpdate = (
      newMetric: MetricsSelectType,
      isInitialBatch = false
    ) => {
      // For initial batch, process immediately without throttling
      if (isInitialBatch) {
        get().addMetric(newMetric);
        initialBatchCount++;
        if (initialBatchCount >= INITIAL_BATCH_SIZE) {
          clearTimeout(initialBatchTimeout);
          initialBatchReceived = true;
        }
        return;
      }

      // For subsequent updates, use throttling
      const now = Date.now();
      const state = get();

      // If enough time has passed, update immediately
      if (now - state._metricsLastUpdate >= METRICS_THROTTLE_MS) {
        // Clear any pending timer
        if (state._metricsThrottleTimer) {
          clearTimeout(state._metricsThrottleTimer);
        }
        set({
          _metricsLastUpdate: now,
          _metricsPendingUpdate: null,
          _metricsThrottleTimer: null,
        });
        get().addMetric(newMetric);
      } else {
        // Queue the update
        set({ _metricsPendingUpdate: newMetric });

        // Schedule update if not already scheduled
        if (!state._metricsThrottleTimer) {
          const delay = METRICS_THROTTLE_MS - (now - state._metricsLastUpdate);
          const timer = setTimeout(() => {
            const pending = get()._metricsPendingUpdate;
            if (pending) {
              set({
                _metricsLastUpdate: Date.now(),
                _metricsPendingUpdate: null,
                _metricsThrottleTimer: null,
              });
              get().addMetric(pending);
            }
          }, delay);
          set({ _metricsThrottleTimer: timer });
        }
      }
    };

    eventSource.addEventListener("metric-update", (event: MessageEvent) => {
      try {
        const newMetric: MetricsSelectType = JSON.parse(event.data);
        processMetricUpdate(newMetric, !initialBatchReceived);
      } catch (error) {
        console.error("Error parsing metric update:", error, event.data);
      }
    });

    // Fallback message listener (in case events come without event type)
    eventSource.addEventListener("message", (event: MessageEvent) => {
      try {
        const newMetric: MetricsSelectType = JSON.parse(event.data);
        processMetricUpdate(newMetric, !initialBatchReceived);
      } catch (error) {
        console.error("Error parsing metric message:", error, event.data);
      }
    });

    eventSource.addEventListener("error", (error) => {
      console.error("Metrics SSE connection error:", error);
      // EventSource.CONNECTING = 0, EventSource.OPEN = 1, EventSource.CLOSED = 2
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("Metrics SSE connection closed");
      }
    });

    // Store eventSource reference for cleanup if needed
    (eventSource as any)._storeRef = eventSource;
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
          });
        }
      } catch (error) {
        console.error("Failed to fetch health status:", error);
        // On error, mark as unhealthy
        get().setHealthStatus({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
        });
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
          const data = (await response.json()) as { data?: WorkerStats };
          if (data.data) {
            get().setWorkerStats(data.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch worker stats:", error);
      }
    };

    const fetchJobs = async () => {
      try {
        const response = await (client as any).worker.jobs.$get({});
        if (response.ok) {
          const data = (await response.json()) as {
            data?: { jobs: JobMetadata[] };
          };
          if (data.data?.jobs) {
            get().setAvailableJobs(data.data.jobs);
          }
        }
      } catch (error) {
        console.error("Failed to fetch available jobs:", error);
      }
    };

    // Fetch immediately
    fetchWorkerStats();
    fetchJobs();

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
