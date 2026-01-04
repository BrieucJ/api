// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LogsPage from "@/pages/LogsPage";
import MetricsPage from "@/pages/MetricsPage";
import ReplayPage from "@/pages/ReplayPage";
import WorkerPage from "@/pages/WorkerPage";
import Login from "@/pages/Login";
import AdminIndex from "@/pages/AdminIndex";
import AdminModelPage from "@/pages/AdminModelPage";
import AdminFormPage from "@/pages/AdminFormPage";
import AdminDetailPage from "@/pages/AdminDetailPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} /> {/* Shows cards */}
          <Route path="logs" element={<LogsPage />} /> {/* Full-page logs */}
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="replay" element={<ReplayPage />} />
          <Route path="worker" element={<WorkerPage />} />
          <Route path="admin" element={<AdminIndex />} />
          <Route path="admin/:modelName" element={<AdminModelPage />} />
          <Route path="admin/:modelName/add" element={<AdminFormPage />} />
          <Route path="admin/:modelName/:id" element={<AdminDetailPage />} />
          <Route
            path="admin/:modelName/:id/change"
            element={<AdminFormPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
