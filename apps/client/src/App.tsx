// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LogsPage from "@/pages/LogsPage";
import MetricsPage from "@/pages/MetricsPage";
import ReplayPage from "@/pages/ReplayPage";
import WorkerPage from "@/pages/WorkerPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} /> {/* Shows cards */}
          <Route path="logs" element={<LogsPage />} /> {/* Full-page logs */}
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="replay" element={<ReplayPage />} />
          <Route path="worker" element={<WorkerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
