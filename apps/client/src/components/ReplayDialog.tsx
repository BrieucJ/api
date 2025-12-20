import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import type { SnapshotSelectType } from "@shared/types";
import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReplayDialogProps {
  snapshot: SnapshotSelectType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReplayDialog({
  snapshot,
  open,
  onOpenChange,
}: ReplayDialogProps) {
  const replayRequest = useAppStore((state) => state.replayRequest);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReplay = async () => {
    setIsReplaying(true);
    setError(null);
    setReplayResult(null);

    try {
      const result = await replayRequest(snapshot.id);
      setReplayResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[85vw] xl:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replay Request</DialogTitle>
          <DialogDescription>
            Replay the captured request: {snapshot.method} {snapshot.path}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Request Details</h3>
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <div>
                <span className="font-semibold">Method:</span>{" "}
                <Badge>{snapshot.method}</Badge>
              </div>
              <div>
                <span className="font-semibold">Path:</span>{" "}
                <code className="bg-background px-2 py-1 rounded">
                  {snapshot.path}
                </code>
              </div>
              {snapshot.query && (
                <div>
                  <span className="font-semibold">Query:</span>
                  <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(snapshot.query, null, 2)}
                  </pre>
                </div>
              )}
              {snapshot.body && (
                <div>
                  <span className="font-semibold">Body:</span>
                  <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(snapshot.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleReplay}
              disabled={isReplaying}
              className="min-w-[120px]"
            >
              {isReplaying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Replaying...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Replay
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">Error</span>
              </div>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {replayResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Replay Successful</span>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Response</h4>
                <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Status Code:</span>{" "}
                    <Badge
                      variant={
                        replayResult.statusCode >= 400
                          ? "destructive"
                          : replayResult.statusCode >= 300
                          ? "secondary"
                          : "default"
                      }
                    >
                      {replayResult.statusCode}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Duration:</span>{" "}
                    {replayResult.duration}ms
                  </div>
                  {replayResult.headers && (
                    <div>
                      <span className="font-semibold">Headers:</span>
                      <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto">
                        {JSON.stringify(replayResult.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                  {replayResult.body && (
                    <div>
                      <span className="font-semibold">Body:</span>
                      <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto max-h-64">
                        {JSON.stringify(replayResult.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
