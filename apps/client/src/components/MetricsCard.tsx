import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, AlertCircle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MetricsCard() {
  const navigate = useNavigate();
  const metrics = useAppStore((state) => state.metrics);
  const initMetricsSSE = useAppStore((state) => state.initMetricsSSE);

  useEffect(() => {
    initMetricsSSE();
  }, [initMetricsSSE]);

  // Calculate summary from recent metrics
  const recentMetrics = metrics.slice(-10);
  const totalTraffic = recentMetrics.reduce(
    (sum, m) => sum + (m.trafficCount || 0),
    0
  );
  const avgErrorRate =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) /
        recentMetrics.length
      : 0;
  const avgLatency =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.p95Latency || 0), 0) /
        recentMetrics.length
      : 0;

  // Add trend calculation and display:
  const previousMetrics = metrics.slice(-20, -10);
  const currentMetrics = metrics.slice(-10);
  // Calculate trends and show ↑/↓ indicators

  return (
    <Card className="hover:shadow-lg transition w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
        <CardDescription className="flex flex-row gap-2 p-0 m-0">
          <div className="text-xs">{metrics.length} windows</div>
          <div className="text-xs">
            {totalTraffic.toLocaleString()} requests
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">Traffic</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              <Activity className="h-4 w-4" />
              {totalTraffic.toLocaleString()}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">Error Rate</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {(avgErrorRate * 100).toFixed(2)}%
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">Avg Latency</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {Math.round(avgLatency)}ms
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/dashboard/metrics")}
        >
          View Details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
