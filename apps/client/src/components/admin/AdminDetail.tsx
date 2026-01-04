import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit } from "lucide-react";
import type { AdminModelConfig } from "@/lib/admin/models";
import { fetchSchema, type AdminSchema } from "@/lib/admin/schema";
import { getClientPath } from "@/lib/admin/client-utils";

interface AdminDetailProps {
  model: AdminModelConfig;
  id: number;
}

export default function AdminDetail({ model, id }: AdminDetailProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<AdminSchema | null>(null);
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
  useEffect(() => {
    if (schema) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const clientPath = getClientPath(model.basePath);
          const response = await clientPath[id.toString()].$get();
          if (response.ok) {
            const result = await response.json();
            setData(result.data);
          } else {
            const errorData = await response.json();
            setError(errorData.error?.message || "Failed to fetch data");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch data");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [id, model.basePath, schema]);

  const formatValue = (value: any, fieldType: string): string => {
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

  if (!schema) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          Loading schema...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          Record not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{model.displayName} Details</h2>
          <p className="text-sm text-muted-foreground">
            View {model.displayName.toLowerCase()} information
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/admin/${model.name}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {model.canEdit && (
            <Button
              onClick={() =>
                navigate(`/dashboard/admin/${model.name}/${id}/change`)
              }
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{model.displayName} Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schema.fields.map((field) => {
            const value = data[field.name];
            const displayValue = formatValue(value, field.type);

            return (
              <div key={field.name} className="space-y-2">
                <Label className="text-sm font-medium">{field.label}</Label>
                {field.type === "json" ? (
                  <pre className="p-4 bg-muted rounded-md text-xs overflow-auto max-h-96">
                    {displayValue}
                  </pre>
                ) : (
                  <div className="text-sm">{displayValue}</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
