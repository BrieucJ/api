import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const response = await fetch(
            `${
              import.meta.env.VITE_BACKEND_URL || "http://localhost:8080"
            }/auth/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ email, password }),
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Login failed");
          }

          const data = await response.json();
          // Handle both old format (token) and new format (accessToken, refreshToken)
          const accessToken = data.data.accessToken || data.data.token;
          const refreshToken = data.data.refreshToken || null;
          const user = data.data.user;

          set({
            accessToken,
            refreshToken,
            user,
            isAuthenticated: true,
          });
        } catch (error) {
          // Clear any existing auth data on error
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) {
          return false;
        }

        try {
          const response = await fetch(
            `${
              import.meta.env.VITE_BACKEND_URL || "http://localhost:8080"
            }/auth/refresh`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ refreshToken }),
            }
          );

          if (!response.ok) {
            // Refresh failed, clear auth
            set({
              accessToken: null,
              refreshToken: null,
              user: null,
              isAuthenticated: false,
            });
            return false;
          }

          const data = await response.json();
          const { accessToken, user } = data.data;

          set({
            accessToken,
            user,
            isAuthenticated: true,
          });

          return true;
        } catch (error) {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: async () => {
        const refreshToken = get().refreshToken;
        const accessToken = get().accessToken;

        // Call logout endpoint to revoke refresh token
        if (refreshToken) {
          try {
            await fetch(
              `${
                import.meta.env.VITE_BACKEND_URL || "http://localhost:8080"
              }/auth/logout`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: accessToken ? `Bearer ${accessToken}` : "",
                },
                credentials: "include",
                body: JSON.stringify({ refreshToken }),
              }
            );
          } catch {
            // Ignore errors, still clear local state
          }
        }

        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const accessToken = get().accessToken;

        if (!accessToken) {
          // Try to refresh if we have a refresh token
          const refreshToken = get().refreshToken;
          if (refreshToken) {
            const refreshed = await get().refreshAccessToken();
            if (refreshed) {
              return;
            }
          }

          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
          });
          return;
        }

        try {
          // Verify token is still valid by calling /auth/me
          const response = await fetch(
            `${
              import.meta.env.VITE_BACKEND_URL || "http://localhost:8080"
            }/auth/me`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              credentials: "include",
            }
          );

          if (!response.ok) {
            // Token is invalid, try to refresh
            if (response.status === 401) {
              const refreshed = await get().refreshAccessToken();
              if (refreshed) {
                return;
              }
            }

            // Clear auth if refresh failed or other error
            set({
              accessToken: null,
              refreshToken: null,
              user: null,
              isAuthenticated: false,
            });
            return;
          }

          const data = await response.json();
          // Update user data from server
          const updatedUser = data.data;

          set({
            accessToken,
            user: updatedUser,
            isAuthenticated: true,
          });
        } catch (error) {
          // Try to refresh on error
          const refreshed = await get().refreshAccessToken();
          if (!refreshed) {
            // Clear auth if refresh failed
            set({
              accessToken: null,
              refreshToken: null,
              user: null,
              isAuthenticated: false,
            });
          }
        }
      },

      getToken: () => {
        return get().accessToken;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
