import { hc } from "hono/client";
import type { AppType } from "@shared/types";
import config from "./config";
import { useAuthStore } from "@/store/authStore";

// Get token function (can be called outside React components)
const getAuthToken = (): string | null => {
  // Access store state directly (works outside React)
  const state = useAuthStore.getState();
  return state.getToken();
};

export const client = hc<AppType>(`${config.BACKEND_URL}/`, {
  init: {
    credentials: "include",
  },
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    // Add Authorization header if token exists
    const token = getAuthToken();
    const headers = new Headers(init?.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  },
});
