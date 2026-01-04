import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdminModelConfig } from "@/lib/admin/models";
import { fetchSchema, type AdminSchema } from "@/lib/admin/schema";
import { getClientPath } from "@/lib/admin/client-utils";

interface AdminFormProps {
  model: AdminModelConfig;
  isEdit?: boolean;
  id?: number;
}

export default function AdminForm({
  model,
  isEdit = false,
  id,
}: AdminFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  // Fetch existing data if editing
  useEffect(() => {
    if (isEdit && id && schema) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const clientPath = getClientPath(model.basePath);
          const response = await clientPath[id.toString()].$get();
          if (response.ok) {
            const result = await response.json();
            setFormData(result.data || {});
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
  }, [isEdit, id, model.basePath, schema]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {};

      // Only include fields that are editable and have values
      schema?.fields.forEach((field) => {
        if (field.readonly) return;

        // Handle password field - only include if provided
        if (field.type === "password") {
          if (formData[field.name]) {
            payload[field.name] = formData[field.name];
          }
          return; // Skip empty passwords
        }

        // Include field if it has a value or is required
        if (formData[field.name] !== undefined && formData[field.name] !== "") {
          // Handle JSON fields
          if (field.type === "json") {
            try {
              payload[field.name] =
                typeof formData[field.name] === "string"
                  ? JSON.parse(formData[field.name])
                  : formData[field.name];
            } catch {
              // Invalid JSON, skip or set as string
              payload[field.name] = formData[field.name];
            }
          } else {
            payload[field.name] = formData[field.name];
          }
        }
      });

      const clientPath = getClientPath(model.basePath);
      let response;

      if (isEdit && id) {
        response = await clientPath[id.toString()].$patch({
          json: payload,
        });
      } else {
        response = await clientPath.$post({
          json: payload,
        });
      }

      if (response.ok) {
        navigate(`/dashboard/admin/${model.name}`);
      } else {
        const errorData = await response.json();
        setError(
          errorData.error?.message ||
            errorData.error?.issues?.[0]?.message ||
            "Failed to save"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.name] ?? "";

    if (field.type === "select") {
      return (
        <Select
          value={String(value)}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, [field.name]: val }))
          }
          disabled={field.readonly}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === "boolean") {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.name}
            checked={value === true || value === "true"}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                [field.name]: e.target.checked,
              }))
            }
            disabled={field.readonly}
          />
          <Label htmlFor={field.name} className="font-normal cursor-pointer">
            {field.label}
          </Label>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          id={field.name}
          value={value}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
          }
          readOnly={field.readonly}
          placeholder={field.label}
        />
      );
    }

    if (field.type === "json") {
      return (
        <Textarea
          id={field.name}
          value={
            typeof value === "object" ? JSON.stringify(value, null, 2) : value
          }
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setFormData((prev) => ({ ...prev, [field.name]: parsed }));
            } catch {
              setFormData((prev) => ({
                ...prev,
                [field.name]: e.target.value,
              }));
            }
          }}
          readOnly={field.readonly}
          className="font-mono"
          rows={10}
        />
      );
    }

    // Default to Input
    let inputType = field.type;
    if (field.type === "datetime" || field.type === "date") {
      inputType = field.type === "datetime" ? "datetime-local" : "date";
    }

    return (
      <Input
        id={field.name}
        type={inputType}
        value={value}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            [field.name]:
              field.type === "number" ? Number(e.target.value) : e.target.value,
          }))
        }
        readOnly={field.readonly}
        required={field.required && !isEdit}
        placeholder={field.label}
      />
    );
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

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {isEdit
                ? `Edit ${model.displayName}`
                : `Add ${model.displayName}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? `Update ${model.displayName.toLowerCase()} details`
                : `Create a new ${model.displayName.toLowerCase()}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/dashboard/admin/${model.name}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{model.displayName} Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {schema.fields.map((field) => {
              // Skip password field on edit if it's empty (optional update)
              if (
                isEdit &&
                field.type === "password" &&
                !formData[field.name]
              ) {
                return null;
              }

              return (
                <div key={field.name} className="space-y-2">
                  {field.type !== "boolean" && (
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && !isEdit && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                  )}
                  {renderField(field)}
                  {field.type === "password" && isEdit && (
                    <p className="text-xs text-muted-foreground">
                      Leave blank to keep current password
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
