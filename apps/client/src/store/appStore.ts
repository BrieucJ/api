import { create } from "zustand";
import type { LogSelectType, ApiInfo, HealthStatus } from "@shared/types";
import config from "@/lib/config";

interface AppStore {
  logs: LogSelectType[];
  addLog: (log: LogSelectType) => void;
  initLogsSSE: () => void;
  _sseStarted: boolean;
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
  apiInfo: null,
  _infoPollingStarted: false,
  healthStatus: null,
  _healthPollingStarted: false,
  addLog: (log) =>
    set((state) => {
      if (state.logs.find((l) => l.id === log.id)) return state;
      return { logs: [...state.logs, log] };
    }),
  setApiInfo: (info) => set({ apiInfo: info }),
  setHealthStatus: (status) => set({ healthStatus: status }),
  initLogsSSE: () => {
    console.log("initLogsSSE");
    if (get()._sseStarted) return;
    get()._sseStarted = true;

    const eventSource = new EventSource(`${config.BACKEND_URL}/logs/stream`);

    eventSource.addEventListener("log-update", (event: MessageEvent) => {
      const newLog: LogSelectType = JSON.parse(event.data);
      get().addLog(newLog);
    });
  },
  initInfoPolling: () => {
    if (get()._infoPollingStarted) {
      return () => {}; // Return no-op cleanup if already started
    }
    set({ _infoPollingStarted: true });

    const fetchInfo = async () => {
      try {
        const response = await fetch(`${config.BACKEND_URL}/info`);
        if (response.ok) {
          const data = await response.json();
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
        const response = await fetch(`${config.BACKEND_URL}/health`);
        if (response.ok) {
          const data = await response.json();
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
