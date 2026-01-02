import { useMemo, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MetricsSelectType } from "@shared/types";

type ChartMode = "traffic" | "performance" | "latency";

interface MetricsChartProps {
  metrics: MetricsSelectType[];
  endpoint?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
  mode?: ChartMode;
}

// Chart configs for different modes
const trafficChartConfig: ChartConfig = {
  traffic: {
    label: "Traffic Count",
    color: "hsl(var(--chart-2))",
  },
};

const performanceChartConfig: ChartConfig = {
  errorRate: {
    label: "Error Rate (%)",
    color: "hsl(var(--destructive))",
  },
  p95: {
    label: "P95 Latency (ms)",
    color: "hsl(var(--chart-2))",
  },
};

const latencyChartConfig: ChartConfig = {
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
  mode = "latency",
}: MetricsChartProps) {
  // Get computed color values from CSS variables and convert to hex/rgb
  // Must be called unconditionally (Rules of Hooks)
  const [trafficColor, setTrafficColor] = useState("#3b82f6"); // Default blue color
  const [errorRateColor, setErrorRateColor] = useState("#ef4444"); // Default red color
  const [latencyColor, setLatencyColor] = useState("#06b6d4"); // Default cyan color

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateColors = () => {
        // Helper to get computed color from CSS variable
        const getComputedColor = (cssVar: string): string => {
          const tempEl = document.createElement("div");
          tempEl.style.color = cssVar;
          document.body.appendChild(tempEl);
          const computedColor = getComputedStyle(tempEl).color;
          document.body.removeChild(tempEl);
          return computedColor && computedColor !== "rgba(0, 0, 0, 0)"
            ? computedColor
            : "";
        };

        const chart2Color = getComputedColor("var(--chart-2)");
        const destructiveColor = getComputedColor("var(--destructive)");

        if (chart2Color) setTrafficColor(chart2Color);
        if (destructiveColor) setErrorRateColor(destructiveColor);
        if (chart2Color) setLatencyColor(chart2Color);
      };

      // Update colors initially
      updateColors();

      // Listen for theme changes
      const observer = new MutationObserver(updateColors);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return () => observer.disconnect();
    }
  }, []);

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
        const windowStart = new Date(m.window_start).getTime();
        return now - windowStart <= rangeMs;
      });
    }

    // Sort by time
    filtered.sort(
      (a, b) =>
        new Date(a.window_start).getTime() - new Date(b.window_start).getTime()
    );

    // Use stable time format (ISO string) instead of toLocaleTimeString
    // to prevent unnecessary re-renders
    return filtered.map((m) => {
      const date = new Date(m.window_start);
      const errorRateValue = m.error_rate ?? 0;
      const errorRatePercent = Number((errorRateValue * 100).toFixed(2));

      return {
        time: date.toISOString(),
        timeLabel: date.toLocaleTimeString(),
        p50: m.p50_latency ?? 0,
        p95: m.p95_latency ?? 0,
        p99: m.p99_latency ?? 0,
        // error_rate comes from API as decimal (0-1), convert to percentage for chart
        errorRate: errorRatePercent,
        traffic: m.traffic_count ?? 0,
      };
    });
  }, [metrics, endpoint, timeRange]);

  // Create a stable key for the chart based on data length and endpoint
  // This helps React properly track when the chart should re-render
  const chartKey = useMemo(
    () => `${mode}-${endpoint || "all"}-${timeRange}-${chartData.length}`,
    [mode, endpoint, timeRange, chartData.length]
  );

  const chartConfig = useMemo(() => {
    switch (mode) {
      case "traffic":
        return trafficChartConfig;
      case "performance":
        return performanceChartConfig;
      case "latency":
      default:
        return latencyChartConfig;
    }
  }, [mode]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        No metrics data available
      </div>
    );
  }

  const timeFormatter = (value: string) => {
    try {
      return new Date(value).toLocaleTimeString();
    } catch {
      return value;
    }
  };

  if (mode === "traffic") {
    return (
      <ChartContainer config={chartConfig} className="h-[350px]">
        <AreaChart
          key={chartKey}
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tickFormatter={timeFormatter} />
          <YAxis />
          <ChartTooltip
            content={<ChartTooltipContent />}
            labelFormatter={timeFormatter}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="traffic"
            stroke={trafficColor}
            fill={trafficColor}
            fillOpacity={0.5}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    );
  }

  // Performance mode: Dual-axis line chart
  if (mode === "performance") {
    return (
      <ChartContainer config={chartConfig} className="h-[350px]">
        <LineChart
          key={chartKey}
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tickFormatter={timeFormatter} />
          <YAxis
            yAxisId="left"
            label={{
              value: "Error Rate (%)",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{
              value: "Latency (ms)",
              angle: 90,
              position: "insideRight",
            }}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            labelFormatter={timeFormatter}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="errorRate"
            stroke={errorRateColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="p95"
            stroke={latencyColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    );
  }

  // Latency mode: Multi-line chart (default/current behavior)
  return (
    <ChartContainer config={chartConfig} className="h-[350px]">
      <LineChart
        key={chartKey}
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={timeFormatter} />
        <YAxis />
        <ChartTooltip
          content={<ChartTooltipContent />}
          labelFormatter={timeFormatter}
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
