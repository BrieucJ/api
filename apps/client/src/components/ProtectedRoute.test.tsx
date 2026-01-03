import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuthStore } from "@/store/authStore";

// Mock the auth store
vi.mock("@/store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children when authenticated as admin", async () => {
    const mockCheckAuth = vi.fn().mockResolvedValue(undefined);
    
    // Mock authenticated admin state
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: true,
        user: { id: 1, email: "admin@test.com", role: "admin" },
        checkAuth: mockCheckAuth,
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for checkAuth to complete and content to appear
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("should redirect when not authenticated", async () => {
    const mockCheckAuth = vi.fn().mockResolvedValue(undefined);
    
    // Mock unauthenticated state
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: false,
        user: null,
        checkAuth: mockCheckAuth,
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for checkAuth to complete, then verify protected content is not shown
    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  it("should show access denied for non-admin user", async () => {
    const mockCheckAuth = vi.fn().mockResolvedValue(undefined);
    
    // Mock authenticated but non-admin state
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = {
        isAuthenticated: true,
        user: { id: 1, email: "user@test.com", role: "user" },
        checkAuth: mockCheckAuth,
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for checkAuth to complete and access denied message to appear
    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    });
  });
});

