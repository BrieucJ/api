import { create } from "zustand";
import type {
  LogSelectType,
  MetricsSelectType,
  SnapshotSelectType,
  ApiInfo,
  HealthStatus,
} from "@shared/types";
import { client } from "@/lib/client";
import config from "@/lib/config";

interface AppStore {
  logs: LogSelectType[];
  addLog: (log: LogSelectType) => void;
  initLogsSSE: () => void;
  _sseStarted: boolean;
  metrics: MetricsSelectType[];
  addMetric: (metric: MetricsSelectType) => void;
  initMetricsSSE: () => void;
  _metricsSseStarted: boolean;
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
}

export const useAppStore = create<AppStore>((set, get) => ({
  logs: [],
  _sseStarted: false,
  metrics: [],
  _metricsSseStarted: false,
  snapshots: [],
  apiInfo: null,
  _infoPollingStarted: false,
  healthStatus: null,
  _healthPollingStarted: false,
  addLog: (log) =>
    set((state) => {
      if (state.logs.find((l) => l.id === log.id)) return state;
      return { logs: [...state.logs, log] };
    }),
  addMetric: (metric) =>
    set((state) => {
      if (state.metrics.find((m) => m.id === metric.id)) return state;
      return { metrics: [...state.metrics, metric] };
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
  initLogsSSE: () => {
    console.log("initLogsSSE");
    if (get()._sseStarted) return;
    set({ _sseStarted: true });

    const eventSource = new EventSource(`${config.BACKEND_URL}/logs/stream`);

    eventSource.addEventListener("log-update", (event: MessageEvent) => {
      const newLog: LogSelectType = JSON.parse(event.data);
      get().addLog(newLog);
    });
  },
  initMetricsSSE: () => {
    if (get()._metricsSseStarted) return;
    set({ _metricsSseStarted: true });

    const eventSource = new EventSource(`${config.BACKEND_URL}/metrics/stream`);

    eventSource.addEventListener("metric-update", (event: MessageEvent) => {
      const newMetric: MetricsSelectType = JSON.parse(event.data);
      get().addMetric(newMetric);
    });
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
}));
