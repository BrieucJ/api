import { client } from "@/lib/client";
import type { AdminModelConfig } from "./models";

export interface AdminField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  readonly?: boolean;
  options?: { value: string; label: string }[];
}

export interface AdminSchema {
  name: string;
  displayName: string;
  fields: AdminField[];
}

export interface AdminModelInfo {
  name: string;
  displayName: string;
  pluralName: string;
  basePath: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export async function fetchSchema(modelName: string): Promise<AdminSchema> {
  const response = await (client as any).admin.schema[modelName].$get();
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch schema");
  }
  const result = await response.json();
  return result.data;
}

export async function fetchModels(): Promise<AdminModelInfo[]> {
  const response = await (client as any).admin.models.$get();
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch models");
  }
  const result = await response.json();
  return result.data;
}
