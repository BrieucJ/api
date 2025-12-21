import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type Column,
  type Table as TanStackTable,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { ArrowUp, ArrowDown, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  enablePagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  showRowCount?: boolean;
  className?: string;
  columnLabels?: Record<string, string>;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  enablePagination = true,
  pageSize = 50,
  emptyMessage = "No results.",
  showRowCount = true,
  className,
  columnLabels = {},
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  isLoading = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: enablePagination
        ? {
            pageSize,
          }
        : undefined,
    },
  });

  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div
      className={`flex flex-col space-y-4 w-full min-w-0 flex-1 min-h-0 ${
        className || ""
      }`}
    >
      <div className="flex items-center gap-2 shrink-0">
        {onSearchChange && (
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
        )}
        <ColumnVisibilityToggle table={table} columnLabels={columnLabels} />
      </div>
      <div className="rounded-md border overflow-hidden flex flex-col w-full min-w-0 flex-1 min-h-0">
        <div
          className="overflow-y-auto overflow-x-auto flex-1 min-h-0 min-w-0 w-full"
          style={{ maxWidth: "100%" }}
        >
          <div className="w-full min-w-0" style={{ maxWidth: "100%" }}>
            <Table className="w-full" style={{ maxWidth: "100%" }}>
              <TableHeader className="sticky top-0 bg-background z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const columnMeta = header.column.columnDef.meta as
                        | { className?: string }
                        | undefined;
                      return (
                        <TableHead
                          key={header.id}
                          className={cn("py-1", columnMeta?.className)}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Show skeleton rows while loading
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id} className="py-1">
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const columnMeta = cell.column.columnDef.meta as
                          | { className?: string }
                          | undefined;
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "py-1 min-w-0",
                              columnMeta?.className
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="h-24 text-center"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      {enablePagination && (
        <div className="flex items-center justify-between">
          {showRowCount && (
            <div className="text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {data.length} results
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ColumnHeader<TData>({
  column,
  table,
  title,
  canSort,
  canHide,
  canFilter,
  filterOptions,
}: {
  column: Column<TData, unknown>;
  table: TanStackTable<TData>;
  title: string;
  canSort: boolean;
  canHide: boolean;
  canFilter?: boolean;
  filterOptions?: { label: string; value: string }[];
}) {
  const sortDirection = column.getIsSorted();
  const filterValue = column.getFilterValue() as string[] | undefined;
  const isFiltered = filterValue && filterValue.length > 0;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="font-medium hover:opacity-70 transition-opacity cursor-pointer text-left flex items-center gap-1 group">
            <span>{title}</span>
            {sortDirection && (
              <span className="text-xs opacity-60">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {canSort && (
            <>
              <DropdownMenuItem
                onClick={() => column.toggleSorting(false)}
                className="cursor-pointer"
              >
                <ArrowUp className="mr-2 h-4 w-4" />
                Sort Ascending
                {sortDirection === "asc" && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => column.toggleSorting(true)}
                className="cursor-pointer"
              >
                <ArrowDown className="mr-2 h-4 w-4" />
                Sort Descending
                {sortDirection === "desc" && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </DropdownMenuItem>
            </>
          )}
          {canFilter && filterOptions && (
            <>
              {canSort && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Filter by {title}
              </div>
              {filterOptions.map((option) => {
                const isSelected = filterValue?.includes(option.value) ?? false;
                return (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const currentFilter =
                        (column.getFilterValue() as string[]) || [];
                      const newFilter = checked
                        ? [...currentFilter, option.value]
                        : currentFilter.filter((v) => v !== option.value);
                      column.setFilterValue(
                        newFilter.length > 0 ? newFilter : undefined
                      );
                    }}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {isFiltered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => column.setFilterValue(undefined)}
                    className="cursor-pointer text-muted-foreground"
                  >
                    Clear filter
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
          {canHide && (
            <>
              {(canSort || canFilter) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => column.toggleVisibility(false)}
                className="cursor-pointer"
              >
                Hide Column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => column.setFilterValue(undefined)}
          title="Clear filter"
        >
          <Filter className="h-3 w-3 text-primary" />
        </Button>
      )}
    </div>
  );
}

function ColumnVisibilityToggle<TData>({
  table,
  columnLabels,
}: {
  table: TanStackTable<TData>;
  columnLabels: Record<string, string>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="ml-auto">
          Columns <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => {
            const label = columnLabels[column.id] || column.id;
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
