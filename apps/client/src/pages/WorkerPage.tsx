import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Database,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export default function WorkerPage() {
  const workerStats = useAppStore((state) => state.workerStats);
  const initWorkerPolling = useAppStore((state) => state.initWorkerPolling);

  useEffect(() => {
    const cleanup = initWorkerPolling();
    return cleanup;
  }, [initWorkerPolling]);

  const scheduledJobs =
    (workerStats?.scheduled_jobs as Array<{
      id: string;
      cronExpression: string;
      jobType: string;
      payload: unknown;
      enabled: boolean;
    }>) || [];
  const availableJobsList =
    (workerStats?.available_jobs as Array<{
      type: string;
      name: string;
      description: string;
      category?: string;
    }>) || [];
  const workerMode = workerStats?.worker_mode || "unknown";

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Worker Monitoring</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Monitor queue statistics, scheduled jobs, and available job types
        </p>
      </div>

      {/* Queue Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Queue Size</CardTitle>
            <Database className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {workerStats?.queue_size ?? 0}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Jobs waiting to be processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {workerStats?.processing_count ?? 0}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Jobs currently being processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Worker Mode</CardTitle>
            <Settings className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="text-lg md:text-2xl font-bold capitalize">{workerMode}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {workerMode === "local" ? "Local queue" : "SQS queue"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs Table */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Scheduled Jobs</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Cron jobs configured to run automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          {scheduledJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Job Type</TableHead>
                    <TableHead className="text-xs md:text-sm hidden sm:table-cell">Cron Expression</TableHead>
                    <TableHead className="text-xs md:text-sm">Status</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <code className="text-[10px] md:text-sm">{job.jobType}</code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <code className="text-[10px] md:text-sm font-mono">
                          {job.cronExpression}
                        </code>
                      </TableCell>
                      <TableCell>
                        {job.enabled ? (
                          <Badge variant="default" className="gap-0.5 md:gap-1 text-[10px] md:text-xs">
                            <CheckCircle2 className="h-2 w-2 md:h-3 md:w-3" />
                            <span className="hidden sm:inline">Enabled</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-0.5 md:gap-1 text-[10px] md:text-xs">
                            <XCircle className="h-2 w-2 md:h-3 md:w-3" />
                            <span className="hidden sm:inline">Disabled</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs text-muted-foreground">
                          {job.id.slice(0, 8)}...
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs md:text-sm text-muted-foreground">
              No scheduled jobs configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Jobs List */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Available Jobs</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            All job types that can be executed by the worker
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          {availableJobsList.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {availableJobsList.map((job) => (
                <div key={job.type} className="border rounded-lg p-3 md:p-4 space-y-1.5 md:space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                        <h3 className="font-semibold text-sm md:text-base">{job.name}</h3>
                        {job.category && (
                          <Badge variant="outline" className="text-[10px] md:text-xs">
                            {job.category}
                          </Badge>
                        )}
                        <code className="text-[10px] md:text-xs text-muted-foreground">
                          {job.type}
                        </code>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {job.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs md:text-sm text-muted-foreground">
              No job metadata available. Worker may be unavailable.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Worker Status */}
      {!workerStats && (
        <Card className="border-dashed">
          <CardContent className="pt-4 md:pt-6 p-3 md:p-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Activity className="h-3 w-3 md:h-4 md:w-4 animate-pulse" />
              <p className="text-xs md:text-sm">
                Connecting to worker... Make sure the worker is running.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
