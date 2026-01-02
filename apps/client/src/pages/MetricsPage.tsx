import { useEffect, useState, useMemo } from "react";
import MetricsChart from "@/components/MetricsChart";
import { useAppStore } from "@/store/appStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MetricsPage() {
  const metrics = useAppStore((state) => state.metrics);
  const initMetricsPolling = useAppStore((state) => state.initMetricsPolling);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");

  useEffect(() => {
    const cleanup = initMetricsPolling();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get unique endpoints - memoized to prevent infinite re-renders
  const endpoints = useMemo(
    () => Array.from(new Set(metrics.map((m) => m.endpoint))).sort(),
    [metrics]
  );

  // Calculate summary stats
  const recentMetrics = metrics.slice(-20);
  const totalTraffic = recentMetrics.reduce(
    (sum, m) => sum + (m.traffic_count || 0),
    0
  );
  const avgErrorRate =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.error_rate || 0), 0) /
        recentMetrics.length
      : 0;
  const avgP95Latency =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.p95_latency || 0), 0) /
        recentMetrics.length
      : 0;

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Total Traffic</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {totalTraffic.toLocaleString()}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Last 20 windows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">
              Avg Error Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {(avgErrorRate * 100).toFixed(2)}%
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Last 20 windows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">
              Avg P95 Latency
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {Math.round(avgP95Latency)}ms
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Last 20 windows</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Latency Metrics</CardTitle>
          <CardDescription className="text-xs md:text-sm">P50, P95, and P99 latency over time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0 md:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="endpoint" className="text-xs md:text-sm">Endpoint Filter</Label>
              <Select
                value={selectedEndpoint}
                onValueChange={setSelectedEndpoint}
              >
                <SelectTrigger id="endpoint" className="h-8 md:h-9 text-xs md:text-sm">
                  <SelectValue placeholder="All endpoints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All endpoints</SelectItem>
                  {endpoints.map((endpoint) => (
                    <SelectItem key={endpoint} value={endpoint}>
                      {endpoint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="timeRange" className="text-xs md:text-sm">Time Range</Label>
              <Select
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as typeof timeRange)}
              >
                <SelectTrigger id="timeRange" className="h-8 md:h-9 text-xs md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <MetricsChart
            metrics={metrics}
            endpoint={selectedEndpoint === "all" ? undefined : selectedEndpoint}
            timeRange={timeRange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
