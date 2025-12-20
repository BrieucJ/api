import LogsCard from "@/components/LogsCard";
import MetricsCard from "@/components/MetricsCard";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useAppStore } from "@/store/appStore";

export default function Dashboard() {
  const navigate = useNavigate();
  const snapshots = useAppStore((state) => state.snapshots);
  const fetchSnapshots = useAppStore((state) => state.fetchSnapshots);

  useEffect(() => {
    fetchSnapshots({ limit: 10 });
  }, [fetchSnapshots]);

  const recentSnapshots = snapshots.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <LogsCard />
        <MetricsCard />
        <Card className="hover:shadow-lg transition w-full overflow-hidden">
          <CardHeader>
            <CardTitle>Request Replay</CardTitle>
            <CardDescription className="flex flex-row gap-2 p-0 m-0">
              <div className="text-xs">{snapshots.length} snapshots</div>
              <div className="text-xs">
                {recentSnapshots.length} recent
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              {recentSnapshots.length > 0 ? (
                recentSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-xs">{snapshot.method}</code>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {snapshot.path}
                      </span>
                    </div>
                    {snapshot.statusCode && (
                      <span
                        className={`text-xs ${
                          snapshot.statusCode >= 400
                            ? "text-destructive"
                            : snapshot.statusCode >= 300
                            ? "text-yellow-600"
                            : "text-green-600"
                        }`}
                      >
                        {snapshot.statusCode}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No snapshots yet
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/dashboard/replay")}
            >
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
