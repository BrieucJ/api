import { useEffect, useState } from "react";
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
  Clock,
  Database,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

export default function WorkerPage() {
  const workerStats = useAppStore((state) => state.workerStats);
  const availableJobs = useAppStore((state) => state.availableJobs);
  const initWorkerPolling = useAppStore((state) => state.initWorkerPolling);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = initWorkerPolling();
    return cleanup;
  }, [initWorkerPolling]);

  const queueStats = workerStats?.queue;
  const scheduledJobs = workerStats?.scheduler.jobs || [];
  const workerMode = workerStats?.mode || "unknown";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Worker Monitoring</h2>
        <p className="text-muted-foreground">
          Monitor queue statistics, scheduled jobs, and available job types
        </p>
      </div>

      {/* Queue Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueStats?.queue_size ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Jobs waiting to be processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueStats?.processing_count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Jobs currently being processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Worker Mode</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{workerMode}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats?.mode === "local" ? "Local queue" : "SQS queue"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>
            Cron jobs configured to run automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledJobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Cron Expression</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <code className="text-sm">{job.jobType}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm font-mono">
                        {job.cronExpression}
                      </code>
                    </TableCell>
                    <TableCell>
                      {job.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {job.id.slice(0, 8)}...
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No scheduled jobs configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Jobs</CardTitle>
          <CardDescription>
            All job types that can be executed by the worker
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableJobs.length > 0 ? (
            <div className="space-y-4">
              {availableJobs.map((job) => (
                <div key={job.type} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{job.name}</h3>
                        {job.category && (
                          <Badge variant="outline" className="text-xs">
                            {job.category}
                          </Badge>
                        )}
                        <code className="text-xs text-muted-foreground">
                          {job.type}
                        </code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setExpandedJob(
                          expandedJob === job.type ? null : job.type
                        )
                      }
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {expandedJob === job.type ? "Hide" : "Show"} Details
                    </button>
                  </div>
                  {expandedJob === job.type && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Default Options
                        </h4>
                        <div className="bg-muted rounded p-3 text-sm">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(job.defaultOptions, null, 2)}
                          </pre>
                        </div>
                      </div>
                      {job.settings && Object.keys(job.settings).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Settings</h4>
                          <div className="bg-muted rounded p-3 text-sm">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(job.settings, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No job metadata available. Worker may be unavailable.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Worker Status */}
      {!workerStats && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4 animate-pulse" />
              <p className="text-sm">
                Connecting to worker... Make sure the worker is running.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
