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

export default function MetricsCard() {
  const navigate = useNavigate();
  const metrics = useAppStore((state) => state.metrics);
  const initMetricsPolling = useAppStore((state) => state.initMetricsPolling);

  useEffect(() => {
    const cleanup = initMetricsPolling();
    return cleanup;
  }, [initMetricsPolling]);

  // Calculate summary from recent metrics
  const recentMetrics = metrics.slice(-10);
  const totalTraffic = recentMetrics.reduce(
    (sum, m) => sum + (m.traffic_count || 0),
    0
  );
  const avgErrorRate =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.error_rate || 0), 0) /
        recentMetrics.length
      : 0;
  const avgLatency =
    recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.p95_latency || 0), 0) /
        recentMetrics.length
      : 0;

  // Add trend calculation and display:
  const previousMetrics = metrics.slice(-20, -10);
  const currentMetrics = metrics.slice(-10);
  // Calculate trends and show ↑/↓ indicators

  return (
    <Card className="hover:shadow-lg transition w-full overflow-hidden">
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="text-base md:text-lg">Metrics</CardTitle>
        <CardDescription className="flex flex-col sm:flex-row gap-1 sm:gap-2 p-0 m-0">
          <div className="text-[10px] md:text-xs">{metrics.length} windows</div>
          <div className="text-[10px] md:text-xs">
            {totalTraffic.toLocaleString()} requests
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:gap-4 p-3 md:p-6 pt-0 md:pt-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 md:gap-1">
            <div className="text-[10px] md:text-xs text-muted-foreground">Traffic</div>
            <div className="text-sm md:text-lg font-semibold flex items-center gap-0.5 md:gap-1">
              <Activity className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-lg">{totalTraffic.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 md:gap-1">
            <div className="text-[10px] md:text-xs text-muted-foreground">Error Rate</div>
            <div className="text-sm md:text-lg font-semibold flex items-center gap-0.5 md:gap-1">
              <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-lg">{(avgErrorRate * 100).toFixed(2)}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 md:gap-1">
            <div className="text-[10px] md:text-xs text-muted-foreground">Avg Latency</div>
            <div className="text-sm md:text-lg font-semibold flex items-center gap-0.5 md:gap-1">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-lg">{Math.round(avgLatency)}ms</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full text-xs md:text-sm h-8 md:h-9"
          onClick={() => navigate("/dashboard/metrics")}
        >
          View Details
          <ArrowRight className="ml-2 h-3 w-3 md:h-4 md:w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
