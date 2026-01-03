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
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    // Add Authorization header if token exists
    const token = getAuthToken();
    const headers = new Headers(init?.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Make the initial request
    let response = await fetch(input, {
      ...init,
      headers,
    });

    // If we get a 401 and have a refresh token, try to refresh
    if (response.status === 401 && token) {
      const state = useAuthStore.getState();
      const refreshed = await state.refreshAccessToken();

      if (refreshed) {
        // Retry the original request with new token
        const newToken = getAuthToken();
        if (newToken) {
          headers.set("Authorization", `Bearer ${newToken}`);
          response = await fetch(input, {
            ...init,
            headers,
          });
        }
      }
    }

    return response;
  },
});
