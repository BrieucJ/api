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
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
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
          const { token, user } = data.data;

          set({
            token,
            user,
            isAuthenticated: true,
          });
        } catch (error) {
          // Clear any existing auth data on error
          set({
            token: null,
            user: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const token = get().token;

        if (!token) {
          set({
            token: null,
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
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              credentials: "include",
            }
          );

          if (!response.ok) {
            // Token is invalid, clear auth
            set({
              token: null,
              user: null,
              isAuthenticated: false,
            });
            return;
          }

          const data = await response.json();
          // Update user data from server
          const updatedUser = data.data;

          set({
            token,
            user: updatedUser,
            isAuthenticated: true,
          });
        } catch (error) {
          // Clear auth on error
          set({
            token: null,
            user: null,
            isAuthenticated: false,
          });
        }
      },

      getToken: () => {
        return get().token;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
