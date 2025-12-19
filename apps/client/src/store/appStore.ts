import { create } from "zustand";
import type { LogSelectType } from "@shared/types";
import config from "@/lib/config";

interface AppStore {
  logs: LogSelectType[];
  addLog: (log: LogSelectType) => void;
  initLogsSSE: () => void;
  _sseStarted: boolean;
}

export const useAppStore = create<AppStore>((set, get) => ({
  logs: [],
  _sseStarted: false,
  addLog: (log) =>
    set((state) => {
      if (state.logs.find((l) => l.id === log.id)) return state;
      return { logs: [...state.logs, log] };
    }),
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
}));
