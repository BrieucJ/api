import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import type { AdminModelConfig } from "@/lib/admin/models";
import { fetchSchema, type AdminSchema } from "@/lib/admin/schema";
import { getClientPath } from "@/lib/admin/client-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminListProps {
  model: AdminModelConfig;
}

export default function AdminList({ model }: AdminListProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<AdminSchema | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch schema on mount
  useEffect(() => {
    const loadSchema = async () => {
      try {
        const schemaData = await fetchSchema(model.name);
        setSchema(schemaData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schema");
      }
    };
    loadSchema();
  }, [model.name]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string> = {
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        order_by: "id",
        order: "desc",
      };

      if (search && schema) {
        // Use all text/email fields as searchable if no specific search fields defined
        const searchableFields = schema.fields.filter(
          (f) => (f.type === "text" || f.type === "email") && !f.readonly
        );
        if (searchableFields.length > 0) {
          query.search = search;
        }
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          query[`${key}__eq`] = value;
        }
      });

      const clientPath = getClientPath(model.basePath);
      const response = await clientPath.$get({ query });

      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
        setPagination((prev) => ({
          ...prev,
          total: result.metadata?.total || 0,
        }));
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schema) {
      fetchData();
    }
  }, [pagination.offset, search, filters, schema]);

  const handleDelete = async () => {
    if (!deleteId || !model.canDelete) return;

    try {
      const clientPath = getClientPath(model.basePath);
      const response = await clientPath[deleteId.toString()].$delete();

      if (response.ok) {
        fetchData();
        setDeleteId(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || "Failed to delete");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      setError(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const formatValue = (
    value: any,
    fieldName: string,
    fieldType: string
  ): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (fieldType === "datetime" || fieldType === "date") {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    }
    if (fieldType === "json") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  // Get list display fields (first 6 non-json fields)
  const listDisplayFields =
    schema?.fields
      .filter(
        (f) =>
          f.type !== "json" &&
          f.name !== "password" &&
          f.name !== "password_hash"
      )
      .slice(0, 6) || [];

  // Get filterable fields (enums and select fields)
  const filterableFields =
    schema?.fields.filter(
      (f) => f.type === "select" && f.options && f.options.length > 0
    ) || [];

  if (!schema) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          Loading schema...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{model.pluralName}</h2>
          <p className="text-sm text-muted-foreground">
            Manage {model.pluralName.toLowerCase()}
          </p>
        </div>
        {model.canCreate && (
          <Button
            onClick={() => navigate(`/dashboard/admin/${model.name}/add`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {model.displayName}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            {schema &&
              schema.fields.some(
                (f) => (f.type === "text" || f.type === "email") && !f.readonly
              ) && (
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              )}
            {filterableFields.map((field) => (
              <div key={field.name} className="w-full md:w-48">
                <Select
                  value={filters[field.name] || "__all__"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      [field.name]: value === "__all__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {model.pluralName.toLowerCase()} found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {listDisplayFields.map((field) => (
                        <TableHead key={field.name}>{field.label}</TableHead>
                      ))}
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <TableRow key={item.id}>
                        {listDisplayFields.map((field) => (
                          <TableCell
                            key={field.name}
                            className="max-w-[200px] truncate"
                          >
                            {formatValue(
                              item[field.name],
                              field.name,
                              field.type
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/dashboard/admin/${model.name}/${item.id}`
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {model.canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/dashboard/admin/${model.name}/${item.id}/change`
                                  )
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {model.canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} to{" "}
                  {Math.min(
                    pagination.offset + pagination.limit,
                    pagination.total
                  )}{" "}
                  of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.offset === 0}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: Math.max(0, prev.offset - prev.limit),
                      }))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      pagination.offset + pagination.limit >= pagination.total
                    }
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: prev.offset + prev.limit,
                      }))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this {model.displayName.toLowerCase()}. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
