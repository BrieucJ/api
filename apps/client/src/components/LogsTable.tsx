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
import { LevelBadge } from "@/components/ui/levelBadge";
import type { Json } from "@/lib/types";
import type { LogSelectType } from "@shared/types";
import { client } from "@/lib/client";

interface LogsTableProps {
  showMetaAsContent?: boolean;
}

export default function LogsTable({
  showMetaAsContent = false,
}: LogsTableProps) {
  const logs = useAppStore((state) => state.logs);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<LogSelectType[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search API calls
  useEffect(() => {
    if (!searchValue.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await client.logs.$get({
          query: {
            search: searchValue,
            limit: 100, // Max limit per schema (max 100)
          },
        });
        const data = await response.json();
        if (data.data) {
          // Transform dates from strings to Date objects
          const transformedData = data.data.map((log: any) => ({
            ...log,
            created_at: new Date(log.created_at),
            updated_at: log.updated_at ? new Date(log.updated_at) : null,
          }));
          setSearchResults(transformedData);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // Use search results if searching, otherwise use regular logs
  const displayLogs = searchValue.trim() ? searchResults : logs;

  // Extract unique values for filtering (use displayLogs to include search results)
  const levelOptions = useMemo(() => {
    const levels = Array.from(new Set(displayLogs.map((log) => log.level)));
    return levels.map((level) => ({ label: level, value: level }));
  }, [displayLogs]);

  const sourceOptions = useMemo(() => {
    const sources = Array.from(new Set(displayLogs.map((log) => log.source)));
    return sources.map((source) => ({ label: source, value: source }));
  }, [displayLogs]);

  const columnLabels = useMemo(
    () => ({
      created_at: "Time",
      level: "Level",
      source: "Source",
      message: "Message",
      meta: "Meta",
    }),
    []
  );

  const columns = useMemo<ColumnDef<LogSelectType>[]>(() => {
    const baseColumns: ColumnDef<LogSelectType>[] = [
      {
        accessorKey: "created_at",
        header: ({ column, table }) => {
          return (
            <ColumnHeader
              column={column}
              table={table}
              title="Time"
              canSort={true}
              canHide={true}
            />
          );
        },
        cell: ({ row }) => {
          return (
            <div className="text-sm truncate">
              {new Date(row.getValue("created_at")).toLocaleString(undefined, {
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: undefined,
                hour12: false,
              })}
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
      },
      {
        accessorKey: "level",
        header: ({ column, table }) => {
          return (
            <ColumnHeader
              column={column}
              table={table}
              title="Level"
              canSort={true}
              canHide={true}
              canFilter={true}
              filterOptions={levelOptions}
            />
          );
        },
        cell: ({ row }) => {
          return (
            <div className="truncate">
              <LevelBadge level={row.getValue("level")} />
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "source",
        header: ({ column, table }) => {
          return (
            <ColumnHeader
              column={column}
              table={table}
              title="Source"
              canSort={true}
              canHide={true}
              canFilter={true}
              filterOptions={sourceOptions}
            />
          );
        },
        cell: ({ row }) => {
          return (
            <div className="text-sm truncate">{row.getValue("source")}</div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
      },
      {
        accessorKey: "message",
        header: ({ column, table }) => {
          return (
            <ColumnHeader
              column={column}
              table={table}
              title="Message"
              canSort={false}
              canHide={true}
            />
          );
        },
        cell: ({ row }) => {
          return (
            <div className="text-sm truncate">{row.getValue("message")}</div>
          );
        },
        enableSorting: false,
        enableColumnFilter: true,
      },
      {
        accessorKey: "meta",
        header: ({ column, table }) => {
          return (
            <ColumnHeader
              column={column}
              table={table}
              title="Meta"
              canSort={false}
              canHide={true}
            />
          );
        },
        cell: ({ row }) => {
          const meta = row.getValue("meta") as Json | null;
          return (
            <div className="text-sm min-w-0 w-full truncate">
              {meta && Object.keys(meta).length > 0 ? (
                showMetaAsContent ? (
                  <div className="flex items-center gap-2 min-w-0 w-full">
                    <div className="text-xs truncate flex-1 min-w-0">
                      {JSON.stringify(meta)}
                    </div>
                    <div className="shrink-0">
                      <MetaButton meta={meta} />
                    </div>
                  </div>
                ) : (
                  <MetaButton meta={meta} />
                )
              ) : null}
            </div>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
      },
    ];

    return baseColumns;
  }, [levelOptions, sourceOptions, showMetaAsContent]);

  return (
    <DataTable
      columns={columns}
      data={displayLogs}
      enablePagination={false}
      pageSize={1000}
      emptyMessage={
        searchValue.trim() && !isSearching ? "No results found" : "No logs yet"
      }
      showRowCount={true}
      columnLabels={columnLabels}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder="Search logs..."
      isLoading={isSearching}
    />
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
