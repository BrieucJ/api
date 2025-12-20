import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MetricsSelectType } from "@shared/types";

interface MetricsChartProps {
  metrics: MetricsSelectType[];
  endpoint?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
}

// Memoize chart config outside component to prevent recreation
const chartConfig: ChartConfig = {
  p50: {
    label: "P50 Latency",
    color: "hsl(var(--chart-1))",
  },
  p95: {
    label: "P95 Latency",
    color: "hsl(var(--chart-2))",
  },
  p99: {
    label: "P99 Latency",
    color: "hsl(var(--chart-3))",
  },
};

export default function MetricsChart({
  metrics,
  endpoint,
  timeRange = "24h",
}: MetricsChartProps) {
  const chartData = useMemo(() => {
    let filtered = [...metrics]; // Create a copy to avoid mutating the original

    if (endpoint) {
      filtered = filtered.filter((m) => m.endpoint === endpoint);
    }

    // Only filter by time range if metrics haven't been pre-filtered
    // (This allows the parent to pass pre-filtered metrics for better performance)
    if (timeRange) {
      const now = Date.now();
      const rangeMs = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      }[timeRange];

      filtered = filtered.filter((m) => {
        const windowStart = new Date(m.windowStart).getTime();
        return now - windowStart <= rangeMs;
      });
    }

    // Sort by time
    filtered.sort(
      (a, b) =>
        new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime()
    );

    // Use stable time format (ISO string) instead of toLocaleTimeString
    // to prevent unnecessary re-renders
    return filtered.map((m) => {
      const date = new Date(m.windowStart);
      return {
        time: date.toISOString(),
        timeLabel: date.toLocaleTimeString(),
        p50: m.p50Latency ?? 0,
        p95: m.p95Latency ?? 0,
        p99: m.p99Latency ?? 0,
        errorRate: Number(((m.errorRate ?? 0) * 100).toFixed(2)),
        traffic: m.trafficCount ?? 0,
      };
    });
  }, [metrics, endpoint, timeRange]);

  // Create a stable key for the chart based on data length and endpoint
  // This helps React properly track when the chart should re-render
  const chartKey = useMemo(
    () => `${endpoint || "all"}-${timeRange}-${chartData.length}`,
    [endpoint, timeRange, chartData.length]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        No metrics data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[350px]">
      <LineChart
        key={chartKey}
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tickFormatter={(value) => {
            try {
              return new Date(value).toLocaleTimeString();
            } catch {
              return value;
            }
          }}
        />
        <YAxis />
        <ChartTooltip
          content={<ChartTooltipContent />}
          labelFormatter={(value) => {
            try {
              return new Date(value).toLocaleTimeString();
            } catch {
              return value;
            }
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="p50"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="p95"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="p99"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
