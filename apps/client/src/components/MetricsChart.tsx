import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MetricsSelectType } from "@shared/types";

interface MetricsChartProps {
  metrics: MetricsSelectType[];
  endpoint?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
}

export default function MetricsChart({ metrics, endpoint, timeRange = "24h" }: MetricsChartProps) {
  const chartData = useMemo(() => {
    let filtered = metrics;
    
    if (endpoint) {
      filtered = filtered.filter((m) => m.endpoint === endpoint);
    }

    // Filter by time range
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

    // Sort by time
    filtered.sort((a, b) => 
      new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime()
    );

    return filtered.map((m) => ({
      time: new Date(m.windowStart).toLocaleTimeString(),
      p50: m.p50Latency,
      p95: m.p95Latency,
      p99: m.p99Latency,
      errorRate: (m.errorRate * 100).toFixed(2),
      traffic: m.trafficCount,
    }));
  }, [metrics, endpoint, timeRange]);

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

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        No metrics data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[350px]">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="p50"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="p95"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="p99"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

