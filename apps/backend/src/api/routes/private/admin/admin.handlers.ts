import type { AppRouteHandler } from "@/utils/types";
import type { ListModelsRoute, GetSchemaRoute } from "./admin.routes";
import { getTableColumns } from "drizzle-orm";
import { getModelTable, getModelMetadata, modelMetadata } from "./admin.models";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

function getColumnType(column: any): string {
  // Get column name for special field detection
  const columnName = (column.name || "").toLowerCase();

  // Check column dataType or constructor name
  const dataType = column.dataType || column.columnType || "";
  const constructorName = column.constructor?.name || "";

  // Check for enum first (has enumValues property)
  if (column.enumValues && Array.isArray(column.enumValues)) {
    return "select";
  }

  // Check for text types
  if (
    dataType === "string" ||
    constructorName.includes("PgText") ||
    constructorName.includes("PgVarchar") ||
    constructorName === "PgText" ||
    constructorName === "PgVarchar"
  ) {
    if (columnName.includes("email")) {
      return "email";
    }
    if (columnName.includes("password")) {
      return "password";
    }
    return "text";
  }

  // Check for number types
  if (
    dataType === "number" ||
    constructorName.includes("PgInteger") ||
    constructorName.includes("PgBigInt") ||
    constructorName === "PgInteger" ||
    constructorName === "PgBigInt"
  ) {
    return "number";
  }

  // Check for date types
  if (
    dataType === "date" ||
    constructorName.includes("PgTimestamp") ||
    constructorName.includes("PgDate") ||
    constructorName === "PgTimestamp" ||
    constructorName === "PgDate"
  ) {
    return "datetime";
  }

  // Check for boolean
  if (
    dataType === "boolean" ||
    constructorName.includes("PgBoolean") ||
    constructorName === "PgBoolean"
  ) {
    return "boolean";
  }

  // Check for JSON
  if (
    dataType === "json" ||
    constructorName.includes("PgJsonb") ||
    constructorName === "PgJsonb"
  ) {
    return "json";
  }

  // Default to text
  return "text";
}

function getEnumValues(
  column: any
): { value: string; label: string }[] | undefined {
  if (column.enumValues && Array.isArray(column.enumValues)) {
    const enumValues = column.enumValues;
    return enumValues.map((v: string) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    }));
  }
  return undefined;
}

function generateLabel(fieldName: string): string {
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const listModels: AppRouteHandler<ListModelsRoute> = async (c) => {
  const models = Object.values(modelMetadata);
  return c.json(
    {
      data: models,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const getSchema: AppRouteHandler<GetSchemaRoute> = async (c) => {
  try {
    const { modelName } = c.req.valid("param");
    const table = getModelTable(modelName);
    const metadata = getModelMetadata(modelName);

    if (!table || !metadata) {
      return c.json(
        {
          data: {
            message: `Model '${modelName}' not found`,
          },
          error: null,
          metadata: null,
        },
        HTTP_STATUS_CODES.NOT_FOUND
      );
    }

    const columns = getTableColumns(table);
    const fields: any[] = [];

    // Fields to skip
    const skipFields = ["password_hash", "deleted_at", "embedding"];

    // Fields that are always readonly
    const readonlyFields = ["id", "created_at", "updated_at"];

    Object.entries(columns).forEach(([name, column]: [string, any]) => {
      // Skip sensitive/system fields
      if (skipFields.includes(name)) {
        return;
      }

      try {
        const fieldType = getColumnType(column);
        const enumValues = getEnumValues(column);

        // Check column properties safely - Drizzle columns have different structures
        // Try multiple ways to access the column definition
        const columnDef = column._?.def || column._ || column;
        const isRequired =
          columnDef.notNull === true ||
          column.notNull === true ||
          columnDef.required === true ||
          column.required === true;
        const hasDefault =
          columnDef.default !== undefined || column.default !== undefined;
        const isReadonly = readonlyFields.includes(name);

        fields.push({
          name,
          label: generateLabel(name),
          type: fieldType,
          required: isRequired && !hasDefault && !isReadonly,
          readonly: isReadonly,
          options: enumValues,
        });
      } catch (error) {
        // Skip fields that cause errors, but log for debugging
        console.error(`Error processing field ${name}:`, error);
        // Still add the field with defaults
        fields.push({
          name,
          label: generateLabel(name),
          type: "text",
          required: false,
          readonly: readonlyFields.includes(name),
          options: undefined,
        });
      }
    });

    return c.json(
      {
        data: {
          name: metadata.name,
          displayName: metadata.displayName,
          fields,
        },
        error: null,
        metadata: null,
      },
      HTTP_STATUS_CODES.OK
    );
  } catch (error) {
    console.error("Error in getSchema handler:", error);
    // Return 500 error - not defined in route schema, so use type assertion
    return c.json(
      {
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ) as any;
  }
};
