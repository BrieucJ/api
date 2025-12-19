// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LogsPage from "@/pages/LogsPage";
// import MetricsPage, AlertsPage when ready

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} /> {/* Shows cards */}
          <Route path="logs" element={<LogsPage />} /> {/* Full-page logs */}
          {/* <Route path="metrics" element={<MetricsPage />} /> */}
          {/* <Route path="alerts" element={<AlertsPage />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
