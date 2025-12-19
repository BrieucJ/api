import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { LevelBadge } from "@/components/ui/levelBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Json } from "@/lib/types";
import { Input } from "./ui/input";

export default function LogsTable() {
  const logs = useAppStore((state) => state.logs);
  const [search, setSearch] = useState("");
  if (logs.length === 0)
    return <p className="text-sm text-gray-500">No logs yet</p>;

  return (
    <div>
      <Input
        placeholder="Search logs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-1/2 text-sm"
      />

      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-1">Time</TableHead>
              <TableHead className="py-1">Level</TableHead>
              <TableHead className="py-1">Source</TableHead>
              <TableHead className="py-1">Message</TableHead>
              <TableHead className="py-1">Meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="py-1 text-sm">
                  {new Date(log.created_at).toLocaleString(undefined, {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: undefined,
                    hour12: false,
                  })}
                </TableCell>
                <TableCell className="py-1 text-sm">
                  <LevelBadge level={log.level} />
                </TableCell>
                <TableCell className="py-1 text-sm">{log.source}</TableCell>
                <TableCell className="py-1 text-sm">{log.message}</TableCell>
                <TableCell className="py-1 text-sm">
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <MetaButton meta={log.meta} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MetaButton({ meta }: { meta: Json }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-6 text-xs">
          Show
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Meta</DialogTitle>
        </DialogHeader>
        <pre className="text-xs overflow-x-auto">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
