import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  AlertCircle,
  Activity,
  Clock,
  TrendingUp,
  Code2,
  Send,
  Globe,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import MetricsChart from "@/components/MetricsChart";
import LogsCard from "@/components/LogsCard";

type Timeframe = "5m" | "15m" | "30m" | "1h" | "6h" | "24h";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "5m", label: "Last 5 minutes" },
  { value: "15m", label: "Last 15 minutes" },
  { value: "30m", label: "Last 30 minutes" },
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
];

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const formatTimeframe = (timeframe: Timeframe): string => {
  return (
    TIMEFRAME_OPTIONS.find((opt) => opt.value === timeframe)?.label || timeframe
  );
};

const timeframeToChartRange = (
  timeframe: Timeframe
): "1h" | "6h" | "24h" | "7d" => {
  if (
    timeframe === "5m" ||
    timeframe === "15m" ||
    timeframe === "30m" ||
    timeframe === "1h"
  ) {
    return "1h";
  }
  if (timeframe === "6h") {
    return "6h";
  }
  return "24h";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const metrics = useAppStore((state) => state.metrics);
  const initMetricsPolling = useAppStore((state) => state.initMetricsPolling);
  const snapshots = useAppStore((state) => state.snapshots);
  const fetchSnapshots = useAppStore((state) => state.fetchSnapshots);

  // Timeframe state
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  // MCP endpoint state
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpResponse, setMcpResponse] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);

  useEffect(() => {
    const cleanup = initMetricsPolling();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch snapshots when timeframe changes
  useEffect(() => {
    const now = new Date();
    const timeframeMs = TIMEFRAME_MS[timeframe];
    const startDate = new Date(now.getTime() - timeframeMs).toISOString();
    const endDate = now.toISOString();

    fetchSnapshots({
      limit: 1000, // Get more snapshots for accurate country stats
      startDate,
      endDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // Calculate KPIs from recent metrics based on selected timeframe
  const recentMetrics = useMemo(() => {
    const now = Date.now();
    const timeframeMs = TIMEFRAME_MS[timeframe];
    const startTime = now - timeframeMs;

    return metrics.filter(
      (m) => new Date(m.window_start).getTime() >= startTime
    );
  }, [metrics, timeframe]);

  // Calculate KPI values - aggregate across all endpoints and windows
  const kpis = useMemo(() => {
    if (recentMetrics.length === 0) {
      return {
        errorRate: 0,
        p95Latency: 0,
        totalTraffic: 0,
        avgResponseTime: 0,
      };
    }

    const totalTraffic = recentMetrics.reduce(
      (sum, m) => sum + (m.traffic_count || 0),
      0
    );

    // Weighted error rate calculation
    // error_rate comes from API as decimal (0-1)
    const totalErrors = recentMetrics.reduce(
      (sum, m) => sum + (m.error_rate || 0) * (m.traffic_count || 0),
      0
    );

    const errorRate = totalTraffic > 0 ? (totalErrors / totalTraffic) * 100 : 0;

    // Traffic-weighted average latencies (better than simple average)
    const weightedP95 =
      recentMetrics.reduce(
        (sum, m) => sum + (m.p95_latency || 0) * (m.traffic_count || 0),
        0
      ) / totalTraffic;

    const weightedP50 =
      recentMetrics.reduce(
        (sum, m) => sum + (m.p50_latency || 0) * (m.traffic_count || 0),
        0
      ) / totalTraffic;

    return {
      errorRate,
      p95Latency: Math.round(weightedP95 || 0),
      totalTraffic,
      avgResponseTime: Math.round(weightedP50 || 0),
    };
  }, [recentMetrics]);

  // Calculate top endpoints by traffic
  const topEndpoints = useMemo(() => {
    const endpointMap = new Map<string, number>();

    recentMetrics.forEach((m) => {
      const current = endpointMap.get(m.endpoint) || 0;
      endpointMap.set(m.endpoint, current + (m.traffic_count || 0));
    });

    return Array.from(endpointMap.entries())
      .map(([endpoint, traffic]) => ({ endpoint, traffic }))
      .sort((a, b) => b.traffic - a.traffic)
      .slice(0, 5);
  }, [recentMetrics]);

  // Calculate top countries by request count
  const topCountries = useMemo(() => {
    const countryMap = new Map<string, number>();

    snapshots.forEach((snapshot) => {
      if (snapshot.geo_country) {
        const current = countryMap.get(snapshot.geo_country) || 0;
        countryMap.set(snapshot.geo_country, current + 1);
      }
    });

    return Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [snapshots]);

  // Calculate trends
  const trends = useMemo(() => {
    if (recentMetrics.length < 10) {
      return { errorRate: 0, traffic: 0, latency: 0 };
    }

    const midPoint = Math.floor(recentMetrics.length / 2);
    const previous = recentMetrics.slice(0, midPoint);
    const current = recentMetrics.slice(midPoint);

    const prevErrorRate =
      previous.reduce(
        (sum, m) => sum + (m.error_rate || 0) * (m.traffic_count || 0),
        0
      ) / previous.reduce((sum, m) => sum + (m.traffic_count || 0), 1);

    const currErrorRate =
      current.reduce(
        (sum, m) => sum + (m.error_rate || 0) * (m.traffic_count || 0),
        0
      ) / current.reduce((sum, m) => sum + (m.traffic_count || 0), 1);

    const prevTraffic = previous.reduce(
      (sum, m) => sum + (m.traffic_count || 0),
      0
    );
    const currTraffic = current.reduce(
      (sum, m) => sum + (m.traffic_count || 0),
      0
    );

    const prevLatency =
      previous.reduce((sum, m) => sum + (m.p95_latency || 0), 0) /
      previous.length;
    const currLatency =
      current.reduce((sum, m) => sum + (m.p95_latency || 0), 0) /
      current.length;

    return {
      errorRate: ((currErrorRate - prevErrorRate) / (prevErrorRate || 1)) * 100,
      traffic: ((currTraffic - prevTraffic) / (prevTraffic || 1)) * 100,
      latency: ((currLatency - prevLatency) / (prevLatency || 1)) * 100,
    };
  }, [recentMetrics]);

  // Handle MCP endpoint test
  const handleMcpTest = async () => {
    if (!mcpEndpoint.trim()) return;

    setMcpLoading(true);
    setMcpResponse(null);

    try {
      const response = await fetch(mcpEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "tools/list",
          params: {},
        }),
      });

      const data = await response.json();
      setMcpResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setMcpResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setMcpLoading(false);
    }
  };

  const TrendIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 1) return null;
    const isPositive = value > 0;
    return (
      <span
        className={`text-[10px] md:text-xs flex items-center gap-0.5 md:gap-1 ${
          isPositive ? "text-red-600" : "text-green-600"
        }`}
      >
        {isPositive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Timeframe Selector */}
      <div className="flex flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Dashboard
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Metrics for {formatTimeframe(timeframe).toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeframe}
            onValueChange={(value) => setTimeframe(value as Timeframe)}
          >
            <SelectTrigger
              id="timeframe-select"
              className="w-[140px] md:w-[180px] text-xs md:text-sm h-8 md:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards Row - 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {/* Error Rate Card */}
        <Card className="hover:shadow-lg transition py-0 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3 md:p-6 pb-1 md:pb-2">
            <div className="space-y-0.5 md:space-y-1">
              <CardTitle className="text-xs md:text-sm font-medium">
                Error Rate
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs hidden sm:block">
                {formatTimeframe(timeframe)}
              </CardDescription>
            </div>
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1.5 px-3 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {kpis.errorRate.toFixed(2)}%
            </div>
            <TrendIndicator value={trends.errorRate} />
          </CardContent>
        </Card>

        {/* P95 Latency Card */}
        <Card className="hover:shadow-lg transition py-0 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3 md:p-6 pb-1 md:pb-2">
            <div className="space-y-0.5 md:space-y-1">
              <CardTitle className="text-xs md:text-sm font-medium">
                P95 Latency
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs hidden sm:block">
                {formatTimeframe(timeframe)}
              </CardDescription>
            </div>
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1.5 px-3 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {kpis.p95Latency}ms
            </div>
            <TrendIndicator value={trends.latency} />
          </CardContent>
        </Card>

        {/* Total Traffic Card */}
        <Card className="hover:shadow-lg transition py-0 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3 md:p-6 pb-1 md:pb-2">
            <div className="space-y-0.5 md:space-y-1">
              <CardTitle className="text-xs md:text-sm font-medium">
                Total Traffic
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs hidden sm:block">
                {formatTimeframe(timeframe)}
              </CardDescription>
            </div>
            <Activity className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1.5 px-3 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {kpis.totalTraffic.toLocaleString()}
            </div>
            <TrendIndicator value={trends.traffic} />
          </CardContent>
        </Card>

        {/* Average Response Time Card */}
        <Card className="hover:shadow-lg transition py-0 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3 md:p-6 pb-1 md:pb-2">
            <div className="space-y-0.5 md:space-y-1">
              <CardTitle className="text-xs md:text-sm font-medium">
                Avg Response
              </CardTitle>
              <CardDescription className="text-[10px] md:text-xs hidden sm:block">
                {formatTimeframe(timeframe)} • P50
              </CardDescription>
            </div>
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1.5 px-3 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {kpis.avgResponseTime}ms
            </div>
            <TrendIndicator value={trends.latency} />
          </CardContent>
        </Card>
      </div>

      {/* MCP Debug Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
        <div className="lg:col-span-2">
          <Card className="border-dashed">
            <CardHeader className="p-3 md:p-6">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 md:h-5 md:w-5" />
                <CardTitle className="text-base md:text-lg">
                  MCP Endpoint Debug
                </CardTitle>
              </div>
              <CardDescription className="text-xs md:text-sm">
                Test your MCP endpoint connection and debug API interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-3 md:p-6 pt-0 md:pt-0">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="mcp-endpoint">MCP Endpoint URL</Label>
                  <Input
                    id="mcp-endpoint"
                    placeholder="https://your-mcp-server.com/api"
                    value={mcpEndpoint}
                    onChange={(e) => setMcpEndpoint(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleMcpTest();
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleMcpTest}
                    disabled={!mcpEndpoint.trim() || mcpLoading}
                  >
                    {mcpLoading ? (
                      <>Testing...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Test
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {mcpResponse && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Response</Label>
                    <pre className="p-4 bg-muted rounded-md text-xs overflow-auto max-h-64">
                      {mcpResponse}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
        {/* Traffic Over Time Chart */}
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-base md:text-lg">
              Traffic Over Time
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Request volume timeline (
              {formatTimeframe(timeframe).toLowerCase()})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <MetricsChart
              metrics={recentMetrics}
              timeRange={timeframeToChartRange(timeframe)}
              mode="traffic"
            />
          </CardContent>
        </Card>

        {/* Error Rate & Latency Chart */}
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-base md:text-lg">
              Performance Metrics
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Error rate and latency percentiles (
              {formatTimeframe(timeframe).toLowerCase()})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <MetricsChart
              metrics={recentMetrics}
              timeRange={timeframeToChartRange(timeframe)}
              mode="performance"
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs */}
      <LogsCard />

      {/* Top Endpoints and Top Countries Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
        {/* Top Endpoints */}
        <Card className="hover:shadow-lg transition">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-base md:text-lg">
              Top Endpoints
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              By traffic volume ({formatTimeframe(timeframe).toLowerCase()})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2 md:space-y-3">
              {topEndpoints.length > 0 ? (
                topEndpoints.map((item, index) => (
                  <div
                    key={item.endpoint}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <Badge
                        variant="outline"
                        className="w-6 md:w-8 justify-center text-[10px] md:text-xs px-1"
                      >
                        {index + 1}
                      </Badge>
                      <code className="text-xs md:text-sm truncate">
                        {item.endpoint}
                      </code>
                    </div>
                    <div className="text-xs md:text-sm font-semibold ml-2">
                      {item.traffic.toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs md:text-sm text-muted-foreground">
                  No endpoint data available
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full mt-3 md:mt-4 text-xs md:text-sm h-8 md:h-9"
              onClick={() => navigate("/dashboard/metrics")}
            >
              View All Metrics
              <ArrowRight className="ml-2 h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card className="hover:shadow-lg transition">
          <CardHeader className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 md:h-5 md:w-5" />
              <CardTitle className="text-base md:text-lg">
                Top Countries
              </CardTitle>
            </div>
            <CardDescription className="text-xs md:text-sm">
              By request count ({formatTimeframe(timeframe).toLowerCase()})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2 md:space-y-3">
              {topCountries.length > 0 ? (
                topCountries.map((item, index) => (
                  <div
                    key={item.country}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <Badge
                        variant="outline"
                        className="w-6 md:w-8 justify-center text-[10px] md:text-xs px-1"
                      >
                        {index + 1}
                      </Badge>
                      <span className="text-xs md:text-sm font-medium">
                        {item.country}
                      </span>
                    </div>
                    <div className="text-xs md:text-sm font-semibold">
                      {item.count.toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs md:text-sm text-muted-foreground">
                  No country data available
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full mt-3 md:mt-4 text-xs md:text-sm h-8 md:h-9"
              onClick={() => navigate("/dashboard/replay")}
            >
              View All Requests
              <ArrowRight className="ml-2 h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
