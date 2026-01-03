# Frontend

## Dashboard

The dashboard (`/dashboard`) provides:

- **KPI Cards**: Error rate, P95 latency, total traffic, average response time
- **Charts**: Traffic over time, performance metrics
- **Recent Logs**: Latest log entries
- **Top Endpoints**: Most requested endpoints
- **Top Countries**: Geographic distribution
- **MCP Debug**: Test MCP endpoint connections

## Real-time Updates

The frontend uses polling for real-time updates:

- **Metrics Polling**: Polls `/metrics` endpoint every 2 seconds
- **Logs Polling**: Polls `/logs` endpoint every 2 seconds

The Zustand store manages polling and state:

```typescript
// Initialize polling
const cleanupLogs = useAppStore((state) => state.initLogsPolling)();
const cleanupMetrics = useAppStore((state) => state.initMetricsPolling)();

// Access data in components
const logs = useAppStore((state) => state.logs);
const metrics = useAppStore((state) => state.metrics);

// Cleanup on unmount
useEffect(() => {
  return () => {
    cleanupLogs();
    cleanupMetrics();
  };
}, []);
```

## Pages

- **Dashboard** (`/dashboard`): Overview with KPIs and charts
- **Logs** (`/dashboard/logs`): Full-page log viewer with filtering
- **Metrics** (`/dashboard/metrics`): Detailed metrics view
- **Replay** (`/dashboard/replay`): Request snapshot browser and replay
- **Worker** (`/dashboard/worker`): Job management interface

## Components

Key components:

- `LogsCard`: Recent logs display
- `LogsTable`: Full log table with filtering
- `MetricsChart`: Interactive charts (Recharts)
- `MetricsCard`: Metrics summary
- `ReplayDialog`: Request replay interface
- `ReplayTable`: Snapshot browser

