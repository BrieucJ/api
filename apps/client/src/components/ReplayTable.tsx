import { useMemo, useState, useEffect } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, ColumnHeader } from "@/components/ui/data-table";
import type { SnapshotSelectType } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { Play, Eye } from "lucide-react";
import ReplayDialog from "./ReplayDialog";

export default function ReplayTable() {
  const snapshots = useAppStore((state) => state.snapshots);
  const fetchSnapshots = useAppStore((state) => state.fetchSnapshots);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<SnapshotSelectType | null>(null);
  const [isReplayDialogOpen, setIsReplayDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchSnapshots({ limit: 100 });
  }, [fetchSnapshots]);

  const columns = useMemo<ColumnDef<SnapshotSelectType>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="ID"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => (
          <div className="font-mono">{row.getValue("id")}</div>
        ),
      },
      {
        accessorKey: "method",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="Method"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => {
          const method = row.getValue("method") as string;
          const variant =
            method === "GET"
              ? "default"
              : method === "POST"
              ? "secondary"
              : "outline";
          return <Badge variant={variant}>{method}</Badge>;
        },
      },
      {
        accessorKey: "path",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="Path"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.getValue("path")}</div>
        ),
      },
      {
        accessorKey: "status_code",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="Status"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => {
          const status = row.getValue("status_code") as number | null;
          if (!status) return <span className="text-muted-foreground">-</span>;
          const variant =
            status >= 400
              ? "destructive"
              : status >= 300
              ? "secondary"
              : "default";
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        accessorKey: "duration",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="Duration"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => {
          const duration = row.getValue("duration") as number | null;
          return duration ? (
            `${duration}ms`
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
      {
        accessorKey: "timestamp",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            table={table}
            title="Timestamp"
            canSort={true}
            canHide={true}
          />
        ),
        cell: ({ row }) => {
          const timestamp = row.getValue("timestamp") as string;
          return new Date(timestamp).toLocaleString();
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const snapshot = row.original;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedSnapshot(snapshot);
                  setIsViewDialogOpen(true);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  setSelectedSnapshot(snapshot);
                  setIsReplayDialogOpen(true);
                }}
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      <DataTable columns={columns} data={snapshots} />
      {selectedSnapshot && (
        <>
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[85vw] xl:max-w-7xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Request Snapshot Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Request</h3>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                    {JSON.stringify(
                      {
                        method: selectedSnapshot.method,
                        path: selectedSnapshot.path,
                        query: selectedSnapshot.query,
                        headers: selectedSnapshot.headers,
                        body: selectedSnapshot.body,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Response</h3>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                    {JSON.stringify(
                      {
                        status_code: selectedSnapshot.status_code,
                        headers: selectedSnapshot.response_headers,
                        body: selectedSnapshot.response_body,
                        duration: selectedSnapshot.duration,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <ReplayDialog
            snapshot={selectedSnapshot}
            open={isReplayDialogOpen}
            onOpenChange={setIsReplayDialogOpen}
          />
        </>
      )}
    </>
  );
}
