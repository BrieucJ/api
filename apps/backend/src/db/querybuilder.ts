import type { Table } from "drizzle-orm/table";
import { getTableColumns } from "drizzle-orm";
import {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  ilike,
  notIlike,
  inArray,
  notInArray,
  between,
  notBetween,
  arrayContains,
  arrayContained,
  arrayOverlaps,
  isNotNull,
  asc,
  desc,
  sql,
  isNull,
  cosineDistance,
  or,
  and,
  type Column,
  type SQL,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import {
  PgTimestamp,
  PgDate,
  PgInteger,
  PgBigInt53,
  PgBoolean,
  PgText,
  PgVarchar,
  PgJsonb,
  PgVector,
} from "drizzle-orm/pg-core";
import { stringToVector } from "@/utils/encode";
import { db } from "@/db/db";
import { dbLogger } from "@/utils/logger";

type Col = Column<any>;
type Val = unknown;
type DbType = PgDatabase<
  PostgresJsQueryResultHKT,
  ExtractTablesWithRelations<any>
>;

// Type-safe filter helpers
type FilterOperators =
  | "eq"
  | "exact"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "notlike"
  | "notilike"
  | "startswith"
  | "istartswith"
  | "endswith"
  | "iendswith"
  | "isnull"
  | "isnotnull"
  | "in"
  | "notin"
  | "between"
  | "notbetween"
  | "arraycontains"
  | "arraycontained"
  | "arrayoverlaps";

// Generate type-safe filter keys from table type
export type FilterKeys<T extends Table> = keyof T["$inferSelect"] extends string
  ? keyof T["$inferSelect"]
  : never;

export type FilterKey<T extends Table> = FilterKeys<T> extends string
  ? `${FilterKeys<T>}__${FilterOperators}`
  : never;

export type JsonbFilterKey<T extends Table> = FilterKeys<T> extends string
  ? `${FilterKeys<T>}__jsonb__${string}__${FilterOperators}`
  : never;

// Combined filter type (allows both typed and untyped for flexibility)
// Object = AND, Array = OR (Django-style)
export type QueryFilters<T extends Table> =
  | Record<string, any> // Object = AND
  | Array<Record<string, any>>; // Array = OR

export const LOOKUP_MAP: Record<string, (col: Col, value: Val) => SQL | any> = {
  eq: (col, v) => eq(col, v),
  exact: (col, v) => eq(col, v),
  ne: (col, v) => ne(col, v),

  gt: (col, v) => gt(col, v),
  gte: (col, v) => gte(col, v),
  lt: (col, v) => lt(col, v),
  lte: (col, v) => lte(col, v),

  like: (col, v) => like(col, `%${v}%`),
  ilike: (col, v) => ilike(col, `%${v}%`),
  notlike: (col, v) => notLike(col, `%${v}%`),
  notilike: (col, v) => notIlike(col, `%${v}%`),

  startswith: (col, v) => like(col, `${v}%`),
  istartswith: (col, v) => ilike(col, `${v}%`),
  endswith: (col, v) => like(col, `%${v}`),
  iendswith: (col, v) => ilike(col, `%${v}`),

  isnull: (col) => isNull(col),
  isnotnull: (col) => isNotNull(col),

  in: (col, v) => inArray(col, v as any[]),
  notin: (col, v) => notInArray(col, v as any[]),

  between: (col, v) => {
    const [min, max] = v as [any, any];
    return between(col, min, max);
  },

  notbetween: (col, v) => {
    const [min, max] = v as [any, any];
    return notBetween(col, min, max);
  },

  arraycontains: (col, v) => arrayContains(col, v as any[]),
  arraycontained: (col, v) => arrayContained(col, v as any[]),
  arrayoverlaps: (col, v) => arrayOverlaps(col, v as any[]),
};

// JSON/JSONB operators
const JSONB_LOOKUP_MAP: Record<string, (col: Col, value: Val) => SQL> = {
  jsonb__contains: (col, v) => {
    // Cast value to JSONB for @> operator
    // Use sql.raw to properly cast the parameterized value
    const jsonStr = typeof v === "string" ? v : JSON.stringify(v);
    // Escape single quotes for SQL safety
    const escaped = jsonStr.replace(/'/g, "''");
    return sql`${col} @> ${sql.raw(`'${escaped}'::jsonb`)}`;
  },
  jsonb__key_exists: (col, v) => sql`${col} ? ${v}`,
  jsonb__all_keys_exist: (col, v) =>
    sql`${col} ?& ${
      Array.isArray(v)
        ? sql`ARRAY[${sql.join(
            (v as any[]).map((k) => sql`${k}`),
            sql`, `
          )}]`
        : sql`ARRAY[${v}]`
    }`,
  jsonb__any_key_exists: (col, v) =>
    sql`${col} ?| ${
      Array.isArray(v)
        ? sql`ARRAY[${sql.join(
            (v as any[]).map((k) => sql`${k}`),
            sql`, `
          )}]`
        : sql`ARRAY[${v}]`
    }`,
  jsonb__eq: (col, v) => {
    // Cast value to JSONB for = operator
    const jsonStr = typeof v === "string" ? v : JSON.stringify(v);
    const escaped = jsonStr.replace(/'/g, "''");
    return sql`${col} = ${sql.raw(`'${escaped}'::jsonb`)}`;
  },
  jsonb__ne: (col, v) => {
    // Cast value to JSONB for != operator
    // Special handling for "null" string to check for non-null JSONB
    if (v === "null" || v === null) {
      return sql`${col} IS NOT NULL`;
    }
    const jsonStr = typeof v === "string" ? v : JSON.stringify(v);
    const escaped = jsonStr.replace(/'/g, "''");
    return sql`${col} != ${sql.raw(`'${escaped}'::jsonb`)}`;
  },
};

function castValueForColumn(col: Column<any>, value: any): any {
  if (value === null || value === undefined) return null;

  if (col instanceof PgTimestamp || col instanceof PgDate) {
    if (value instanceof Date) return value;

    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date value for column ${col.name}`);
    }
    return d;
  }

  if (col instanceof PgInteger || col instanceof PgBigInt53) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      throw new Error(`Invalid number value for column ${col.name}`);
    }
    return n;
  }

  if (col instanceof PgBoolean) {
    return value === true || value === "true";
  }

  return value;
}

function castFilterValue(col: Column<any>, lookup: string, rawValue: any) {
  if (["in", "notin"].includes(lookup)) {
    return String(rawValue)
      .split(",")
      .map((v) => castValueForColumn(col, v));
  }

  if (["between", "notbetween"].includes(lookup)) {
    const arr = String(rawValue)
      .split(",")
      .map((v) => v.trim());

    if (arr.length !== 2)
      throw new Error(`Invalid ${lookup} filter for column ${col.name}`);

    const values = arr.map((v) => castValueForColumn(col, v));
    return values;
  }

  return castValueForColumn(col, rawValue);
}

function getEmbeddingDimension(col: Column<any>): number {
  // Try to get dimension from PgVector column
  if (col instanceof PgVector) {
    // PgVector stores dimension in the column definition
    const def = (col as any)._?.def || (col as any)._;
    if (def?.dimensions) {
      return def.dimensions;
    }
  }
  // Default to 16 if not found
  return 16;
}

export interface QueryBuilderOptions {
  excludeColumns?: string[];
  transaction?: DbType;
  queryLogger?: {
    enabled?: boolean;
    slowQueryThreshold?: number; // milliseconds
  };
}

interface QueryMetadata {
  table: string;
  operation: string;
  duration: number;
  sql?: string;
  params?: any[];
}

export interface ListOptions<T extends Table = any> {
  filters?: QueryFilters<T>;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?:
    | { field: string; order: "asc" | "desc" }
    | Array<{ field: string; order: "asc" | "desc" }>;
  select?: string[];
  searchOptions?: {
    dimension?: number;
    threshold?: number;
  };
  includeDeleted?: boolean;
}

export interface UpsertOptions {
  conflictFields: string[];
  updateFields?: string[];
}

export interface CountOptions<T extends Table = any> {
  filters?: QueryFilters<T>;
  includeDeleted?: boolean;
}

export interface GetByOptions<T extends Table = any> {
  filters: QueryFilters<T>;
  order_by?: { field: string; order: "asc" | "desc" };
  select?: string[];
  includeDeleted?: boolean;
}

export interface AggregateOptions<T extends Table = any> {
  filters?: QueryFilters<T>;
  groupBy?: string[];
  aggregations: {
    field: string;
    function: "sum" | "avg" | "min" | "max" | "count";
    alias?: string;
  }[];
  includeDeleted?: boolean;
}

export class QueryBuilder<T extends Table> {
  private readonly table: T;
  private readonly db: DbType;
  private readonly transactionContext?: DbType;
  private readonly columns: ReturnType<typeof getTableColumns<T>>;
  private readonly colNames: string[];
  private readonly tableName: string;
  private readonly excludeColumns: string[];
  private readonly queryLogger: NonNullable<QueryBuilderOptions["queryLogger"]>;
  private readonly visibleColumns: ReturnType<typeof getTableColumns<T>>;

  constructor(table: T, options: QueryBuilderOptions = {}) {
    const {
      excludeColumns = ["deleted_at", "password_hash"],
      transaction,
      queryLogger = { enabled: true, slowQueryThreshold: 1000 },
    } = options;

    this.table = table;
    // Lazy-load db to avoid circular dependency
    this.db = db;
    this.transactionContext = transaction;
    this.columns = getTableColumns(table);
    this.colNames = Object.keys(this.columns);
    const tableSymbol = Symbol.for("drizzle:Name");
    this.tableName = ((table as any)[tableSymbol] as string) || "unknown";
    this.excludeColumns = excludeColumns;
    this.queryLogger = queryLogger;
    this.visibleColumns = this.getVisibleColumns(false);
  }

  // Get the database instance (transaction if provided, otherwise the base db)
  private get dbInstance(): DbType {
    return this.transactionContext || this.db;
  }

  // Private helper methods
  private async logQuery<TResult>(
    operation: string,
    fn: () => Promise<TResult>,
    metadata?: { sql?: string; params?: any[] }
  ): Promise<TResult> {
    const start = Date.now();
    let error: Error | null = null;

    try {
      const result = await fn();
      const duration = Date.now() - start;

      if (this.queryLogger.enabled) {
        const queryMeta: QueryMetadata = {
          table: this.tableName,
          operation,
          duration,
          ...metadata,
        };

        // Log slow queries at info level
        if (
          this.queryLogger.slowQueryThreshold &&
          duration >= this.queryLogger.slowQueryThreshold
        ) {
          dbLogger.info(
            "info",
            `Slow query detected: ${operation} on ${this.tableName} took ${duration}ms`,
            queryMeta
          );
        } else {
          // Log all queries at debug level
          dbLogger.debug(
            "debug",
            `Query: ${operation} on ${this.tableName} (${duration}ms)`,
            queryMeta
          );
        }
      }

      return result;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      const duration = Date.now() - start;

      if (this.queryLogger.enabled) {
        const queryMeta: QueryMetadata = {
          table: this.tableName,
          operation,
          duration,
          ...metadata,
        };

        dbLogger.error(
          "error",
          `Query error: ${operation} on ${this.tableName} failed after ${duration}ms`,
          { ...queryMeta, error: error.message }
        );
      }

      throw error;
    }
  }

  private validateFieldExists(field: string, operation: string): void {
    if (!this.colNames.includes(field)) {
      throw new Error(
        `Invalid field '${field}' in ${operation}. Available fields: ${this.colNames.join(
          ", "
        )}`
      );
    }
  }

  private validateLookup(lookup: string, field: string): void {
    const allLookups = { ...LOOKUP_MAP, ...JSONB_LOOKUP_MAP };
    if (!allLookups[lookup] && !lookup.startsWith("jsonb__")) {
      throw new Error(
        `Invalid lookup operator '${lookup}' for field '${field}'. Available operators: ${Object.keys(
          LOOKUP_MAP
        ).join(", ")}`
      );
    }
  }

  private baseQuery(qb: any, includeDeleted = false) {
    // global filter: soft delete (unless includeDeleted is true)
    if (this.columns.deleted_at && !includeDeleted) {
      qb = qb.where(isNull(this.columns.deleted_at));
    }
    return qb;
  }

  private getVisibleColumns(includeDeletedAt = false): typeof this.columns {
    const colsToExclude = includeDeletedAt
      ? this.excludeColumns.filter((col) => col !== "deleted_at")
      : this.excludeColumns;
    return Object.fromEntries(
      Object.entries(this.columns).filter(
        ([key]) => !colsToExclude.includes(key)
      )
    ) as typeof this.columns;
  }

  private getSelectColumns(
    selectFields?: string[],
    includeDeletedAt = false
  ): typeof this.columns {
    if (!selectFields || selectFields.length === 0) {
      return this.getVisibleColumns(includeDeletedAt);
    }

    // Validate all selected fields exist
    const colsToExclude = includeDeletedAt
      ? this.excludeColumns.filter((col) => col !== "deleted_at")
      : this.excludeColumns;
    for (const field of selectFields) {
      this.validateFieldExists(field, "select");
      if (colsToExclude.includes(field)) {
        throw new Error(`Cannot select excluded column '${field}'`);
      }
    }

    return Object.fromEntries(
      selectFields.map((key) => {
        if (!this.columns[key]) {
          throw new Error(`Column '${key}' does not exist`);
        }
        return [key, this.columns[key]];
      })
    ) as typeof this.columns;
  }

  private processFilterObject(filters: Record<string, any>): SQL[] {
    const whereClauses: SQL[] = [];

    // Only process keys that match filter syntax (contain __ for operators)
    // This automatically excludes query parameters like select, limit, offset, etc.
    // Filter syntax: field__operator (e.g., email__eq, age__gte)
    const filterEntries = Object.entries(filters || {}).filter(
      ([key, value]) => {
        // Must have __ to be a filter (field__operator pattern)
        // Skip undefined values, but allow null for isnull/isnotnull operators
        if (!key.includes("__") || value === undefined) {
          return false;
        }
        // Allow null values for isnull/isnotnull operators
        const parts = key.toLowerCase().split("__");
        const lookup = parts[parts.length - 1];
        if (lookup === "isnull" || lookup === "isnotnull") {
          return true; // Allow null value for these operators
        }
        return value !== null;
      }
    );

    if (filterEntries.length === 0) {
      return whereClauses;
    }

    for (const [rawKey, rawValue] of filterEntries) {
      const parts = rawKey.toLowerCase().split("__");
      const field = parts[0]!;

      // Handle JSONB nested keys: meta__jsonb__key__eq or meta__jsonb__level1__level2__key__eq
      let lookup: string;
      let jsonbPathSegments: string[] | undefined;

      // Find jsonb marker in parts array
      const jsonbIndex = parts.findIndex((p) => p === "jsonb");
      if (jsonbIndex >= 0 && jsonbIndex < parts.length - 1) {
        // JSONB query detected: field__jsonb__path1__path2__...__key__operator
        // Extract all path segments between jsonb and the operator
        // The last part is the operator, everything between jsonb and last is the path
        const pathAndOperator = parts.slice(jsonbIndex + 1);
        if (pathAndOperator.length === 0) {
          throw new Error(
            `Invalid JSONB filter format: ${rawKey}. Expected field__jsonb__path__operator`
          );
        }

        // Last element is the operator, rest is the path
        lookup = pathAndOperator[pathAndOperator.length - 1] || "eq";
        jsonbPathSegments = pathAndOperator.slice(0, -1);

        this.validateFieldExists(field, "filter");

        const col = this.columns[field];
        if (!(col instanceof PgJsonb)) {
          throw new Error(`Field '${field}' is not a JSONB column`);
        }

        // If there are path segments, this is a nested path query
        // Otherwise, check if it's a JSONB column operator
        if (jsonbPathSegments.length === 0) {
          // No path segments - check if this is a JSONB column operator
          const jsonbColumnOp = JSONB_LOOKUP_MAP[`jsonb__${lookup}`];
          if (jsonbColumnOp) {
            whereClauses.push(jsonbColumnOp(col, rawValue));
            continue;
          } else {
            throw new Error(
              `Invalid JSONB filter format: ${rawKey}. Path cannot be empty. Use field__jsonb__operator for JSONB column operators, or field__jsonb__path__operator for nested paths.`
            );
          }
        }

        // This is a nested path query: field__jsonb__path1__path2__...__key__operator

        // Build nested JSONB path access
        // Use -> for intermediate levels (returns JSONB) and ->> for final level (returns text)
        // Example: col->'level1'->'level2'->>'key'
        let jsonbCol: SQL = col as any;
        for (let i = 0; i < jsonbPathSegments.length; i++) {
          const segment = jsonbPathSegments[i]!;
          if (i === jsonbPathSegments.length - 1) {
            // Final segment: use ->> to get text
            jsonbCol = sql`${jsonbCol}->>${sql.raw(`'${segment}'`)}`;
          } else {
            // Intermediate segment: use -> to get JSONB
            jsonbCol = sql`${jsonbCol}->${sql.raw(`'${segment}'`)}`;
          }
        }

        const value = castFilterValue(col, lookup, rawValue);

        // For JSONB path queries, we support eq, ne, like, ilike on the extracted value
        if (lookup === "eq") {
          whereClauses.push(eq(jsonbCol, value));
        } else if (lookup === "ne") {
          whereClauses.push(ne(jsonbCol, value));
        } else if (lookup === "like") {
          whereClauses.push(like(jsonbCol, `%${value}%`));
        } else if (lookup === "ilike") {
          whereClauses.push(ilike(jsonbCol, `%${value}%`));
        } else {
          throw new Error(
            `Unsupported JSONB path operator '${lookup}'. Supported operators for paths: eq, ne, like, ilike`
          );
        }
        continue;
      } else {
        lookup = parts[1] ?? "eq";
      }

      // Validate field exists
      this.validateFieldExists(field, "filter");
      this.validateLookup(lookup, field);

      const col = this.columns[field];
      if (!col) {
        throw new Error(`Column '${field}' not found in table`);
      }

      const value = castFilterValue(col, lookup, rawValue);
      const operator = LOOKUP_MAP[lookup];
      if (!operator) {
        throw new Error(
          `Invalid lookup operator '${lookup}' for field '${field}'`
        );
      }

      whereClauses.push(operator(col, value));
    }

    return whereClauses;
  }

  private processFilters(filters: QueryFilters<T>): SQL[] {
    // Array = OR: each element is AND conditions
    if (Array.isArray(filters)) {
      const orClauses: SQL[] = [];
      for (const filterGroup of filters) {
        const andClauses = this.processFilterObject(filterGroup);
        if (andClauses.length > 0) {
          orClauses.push(and(...andClauses)!);
        }
      }
      return orClauses.length > 0 ? [or(...orClauses)!] : [];
    }

    // Object = AND: all conditions AND'd together
    const andClauses = this.processFilterObject(filters);
    // Combine multiple AND clauses into a single clause
    return andClauses.length > 0 ? [and(...andClauses)!] : [];
  }

  // Public methods
  /**
   * List records with filters, pagination, search, and ordering
   * @param options - Query options including filters, pagination, search, and ordering
   * @returns Promise with data array and total count
   */
  async list(
    options: ListOptions<T> = {}
  ): Promise<{ data: T["$inferSelect"][]; total: number }> {
    const {
      filters,
      search,
      limit = 20,
      offset = 0,
      order_by = { field: "id", order: "asc" },
      select,
      searchOptions = {},
      includeDeleted = false,
    } = options;

    const selectColumns = this.getSelectColumns(select, includeDeleted);
    let qb = this.baseQuery(
      this.dbInstance.select(selectColumns).from(this.table as any),
      includeDeleted
    );
    let countQb = this.baseQuery(
      this.dbInstance
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(this.table as any),
      includeDeleted
    );

    // Process filters using the new function (handles both object AND and array OR)
    // Only process if filters is provided and is not an empty object/array
    const whereClauses =
      filters &&
      (Array.isArray(filters)
        ? filters.length > 0
        : Object.keys(filters).length > 0)
        ? this.processFilters(filters)
        : [];

    for (const clause of whereClauses) {
      qb = qb.where(clause);
      countQb = countQb.where(clause);
    }

    // Hybrid search: Combine keyword (text) search with vector (semantic) search
    // If no embedding column, fall back to text-only search
    if (search) {
      if (this.columns.embedding) {
        const embeddingDimension =
          searchOptions.dimension ||
          getEmbeddingDimension(this.columns.embedding);
        const threshold = searchOptions.threshold ?? 0.6;
        const searchVector = stringToVector(search, embeddingDimension);
        const distance = cosineDistance(this.columns.embedding, searchVector);
        const searchPattern = `%${search}%`;

        // Find text-searchable columns automatically by type
        const textSearchableColumns: Column<any>[] = [];
        const excludedFromSearch = [
          "id",
          "embedding",
          "deleted_at",
          "password_hash",
          "created_at",
          "updated_at",
        ];

        for (const [fieldName, col] of Object.entries(this.columns)) {
          // Skip excluded columns
          if (excludedFromSearch.includes(fieldName)) continue;

          // Check if column is a text type (PgText or PgVarchar)
          if (col instanceof PgText || col instanceof PgVarchar) {
            textSearchableColumns.push(col);
          }
        }

        // Build keyword search conditions (ILIKE for case-insensitive)
        // Use OR to combine multiple column searches
        const keywordConditions: SQL[] = [];
        for (const col of textSearchableColumns) {
          keywordConditions.push(ilike(col, searchPattern));
        }
        const keywordSearch =
          keywordConditions.length > 0 ? or(...keywordConditions)! : sql`false`;

        // Optimized: Use database-side ranking with ORDER BY
        // Order by: keyword matches first (DESC), then vector distance (ASC)
        // Filter by threshold in WHERE clause
        const searchQb = this.baseQuery(
          this.dbInstance
            .select({
              ...selectColumns,
              hasKeywordMatch: sql<boolean>`${keywordSearch}`.as(
                "has_keyword_match"
              ),
              vectorDistance: distance.as("vector_distance"),
            })
            .from(this.table as any),
          includeDeleted
        );

        // Apply existing filters
        for (const clause of whereClauses) {
          searchQb.where(clause);
        }

        // Filter: only include keyword matches OR vector matches below threshold
        searchQb.where(or(keywordSearch, sql`${distance} < ${threshold}`)!);

        // Order by: keyword matches first (true = 1, false = 0), then vector distance
        // Use CASE to convert boolean to int for proper ordering
        searchQb.orderBy(
          sql`CASE WHEN ${keywordSearch} THEN 0 ELSE 1 END`,
          sql`${distance} ASC`
        );

        // Limit results directly in database
        const candidates = (await this.logQuery(
          "list (search with embedding)",
          async () => await searchQb.limit(limit)
        )) as Array<
          T["$inferSelect"] & {
            hasKeywordMatch: boolean;
            vectorDistance: number;
          }
        >;

        // Remove computed fields
        const finalResults = candidates.map(
          ({ hasKeywordMatch: _, vectorDistance: __, ...item }) => item
        ) as T["$inferSelect"][];

        // Count total relevant results (keyword + reasonable vector matches)
        const searchCountQb = this.baseQuery(
          this.dbInstance
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(this.table as any),
          includeDeleted
        );

        for (const clause of whereClauses) {
          searchCountQb.where(clause);
        }

        // Count: keyword matches OR vector matches with distance < threshold
        searchCountQb.where(
          or(keywordSearch, sql`${distance} < ${threshold}`)!
        );

        const [countRow] = await this.logQuery(
          "list (search with embedding)",
          async () => await searchCountQb
        );

        return {
          data: finalResults,
          total: countRow?.count || 0,
        };
      } else {
        // Text-only search (no embedding column)
        const searchPattern = `%${search}%`;

        // Find text-searchable columns automatically by type
        const textSearchableColumns: Column<any>[] = [];
        const excludedFromSearch = [
          "id",
          "embedding",
          "deleted_at",
          "password_hash",
          "created_at",
          "updated_at",
        ];

        for (const [fieldName, col] of Object.entries(this.columns)) {
          // Skip excluded columns
          if (excludedFromSearch.includes(fieldName)) continue;

          // Check if column is a text type (PgText or PgVarchar)
          if (col instanceof PgText || col instanceof PgVarchar) {
            textSearchableColumns.push(col);
          }
        }

        // Build keyword search conditions (ILIKE for case-insensitive)
        const keywordConditions: SQL[] = [];
        for (const col of textSearchableColumns) {
          keywordConditions.push(ilike(col, searchPattern));
        }

        if (keywordConditions.length > 0) {
          const keywordSearch = or(...keywordConditions)!;

          // Apply search filter
          qb = qb.where(keywordSearch);
          countQb = countQb.where(keywordSearch);
        }
      }
    }

    // Handle ordering - support both single object and array formats
    if (Array.isArray(order_by)) {
      // Multiple order_by fields
      for (const orderItem of order_by) {
        this.validateFieldExists(orderItem.field, "order_by");
        const orderFn = orderItem.order === "asc" ? asc : desc;
        qb = qb.orderBy(orderFn((this.table as any)[orderItem.field]));
      }
    } else {
      // Single order_by field
      this.validateFieldExists(order_by.field, "order_by");
      const orderFn = order_by.order === "asc" ? asc : desc;
      qb = qb.orderBy(orderFn((this.table as any)[order_by.field]));
    }

    qb = qb.limit(limit).offset(offset);

    const [totalRow] = await this.logQuery(
      "list (count)",
      async () => await countQb
    );
    const items = await this.logQuery("list", async () => await qb);

    return {
      data: items as T["$inferSelect"][],
      total: totalRow?.count || 0,
    };
  }

  /**
   * Get a single record by ID
   * @param id - Record ID
   * @param options - Optional options including includeDeleted
   * @returns Promise with record or null if not found
   */
  async get(
    id: number,
    options?: { select?: string[]; includeDeleted?: boolean }
  ): Promise<T["$inferSelect"] | null> {
    const { select, includeDeleted = false } = options || {};
    const selectColumns = this.getSelectColumns(select, includeDeleted);

    const result = await this.logQuery("get", async () => {
      const whereCondition =
        this.columns.deleted_at && !includeDeleted
          ? and(
              eq((this.table as any).id, id),
              isNull(this.columns.deleted_at)
            )!
          : eq((this.table as any).id, id);

      return await this.dbInstance
        .select(selectColumns)
        .from(this.table as any)
        .where(whereCondition)
        .limit(1);
    });
    const [item] = Array.isArray(result) ? result : [result];
    return (item as T["$inferSelect"]) || null;
  }

  /**
   * Get first record matching filters
   * @param options - Filter conditions and optional ordering options
   * @returns Promise with first matching record or null
   */
  async getBy(options: GetByOptions<T>): Promise<T["$inferSelect"] | null> {
    const {
      filters,
      order_by = { field: "id", order: "desc" },
      select,
      includeDeleted = false,
    } = options;
    this.validateFieldExists(order_by.field, "order_by");
    const orderFn = order_by.order === "asc" ? asc : desc;
    const selectColumns = this.getSelectColumns(select, includeDeleted);

    let qb = this.baseQuery(
      this.dbInstance.select(selectColumns).from(this.table as any),
      includeDeleted
    );

    // Process filters using the new function (handles both object AND and array OR)
    const whereClauses = this.processFilters(filters);

    for (const clause of whereClauses) {
      qb = qb.where(clause);
    }

    const [item] = await this.logQuery("getBy", async () => {
      return await qb
        .orderBy(orderFn((this.table as any)[order_by.field]))
        .limit(1);
    });
    return (item as T["$inferSelect"]) || null;
  }

  /**
   * Get first record ordered by specified field
   * @param options - Optional ordering options
   * @returns Promise with first record or null
   */
  async getFirst(options?: {
    order_by?: { field: string; order: "asc" | "desc" };
    select?: string[];
    includeDeleted?: boolean;
  }): Promise<T["$inferSelect"] | null> {
    const {
      order_by = { field: "id", order: "desc" },
      select,
      includeDeleted = false,
    } = options || {};
    this.validateFieldExists(order_by.field, "order_by");
    const orderFn = order_by.order === "asc" ? asc : desc;
    const selectColumns = this.getSelectColumns(select, includeDeleted);

    const [item] = await this.logQuery("getFirst", async () => {
      return await this.baseQuery(
        this.dbInstance.select(selectColumns).from(this.table as any),
        includeDeleted
      )
        .orderBy(orderFn((this.table as any)[order_by.field]))
        .limit(1);
    });
    return (item as T["$inferSelect"]) || null;
  }

  /**
   * Count records matching filters
   * @param options - Optional filter conditions
   * @returns Promise with count
   */
  async count(options: CountOptions<T> = {}): Promise<number> {
    const { filters, includeDeleted = false } = options;

    let countQb = this.baseQuery(
      this.dbInstance
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(this.table as any),
      includeDeleted
    );

    if (filters) {
      // Process filters using the new function (handles both object AND and array OR)
      const whereClauses = this.processFilters(filters);

      for (const clause of whereClauses) {
        countQb = countQb.where(clause);
      }
    }

    const [result] = await this.logQuery("count", async () => await countQb);
    return result?.count || 0;
  }

  /**
   * Check if a record exists by ID
   * @param id - Record ID
   * @returns Promise with boolean
   */
  async exists(
    id: number,
    options?: { includeDeleted?: boolean }
  ): Promise<boolean> {
    const result = await this.count({
      filters: { id__eq: id },
      includeDeleted: options?.includeDeleted ?? false,
    });
    return result > 0;
  }

  /**
   * Create a new record
   * @param data - Record data to insert
   * @returns Promise with created record
   */
  async create(
    data: T["$inferInsert"],
    options?: { select?: string[] }
  ): Promise<T["$inferSelect"]> {
    const { select } = options || {};
    const selectColumns = this.getSelectColumns(select);
    const [created] = await this.logQuery("create", async () => {
      return await this.dbInstance
        .insert(this.table)
        .values(data)
        .returning(selectColumns);
    });
    return created as T["$inferSelect"];
  }

  /**
   * Update a record by ID
   * @param id - Record ID
   * @param data - Partial data to update
   * @returns Promise with updated record or null if not found
   */
  async update(
    id: number,
    data: Partial<T["$inferInsert"]>,
    options?: { select?: string[] }
  ): Promise<T["$inferSelect"] | null> {
    const { select } = options || {};
    const [existing] = await this.logQuery("update (check)", async () => {
      return await this.dbInstance
        .select({ id: (this.table as any).id })
        .from(this.table as any)
        .where(eq((this.table as any).id, id))
        .limit(1);
    });

    if (!existing) return null;

    const {
      id: _ignored,
      created_at: _createdAt,
      deleted_at: _deletedAt,
      updated_at: _updatedAt,
      ...updateFields
    } = data;

    // Update with only the provided fields
    // Note: updated_at is handled by schema's $onUpdate
    const selectColumns = this.getSelectColumns(select);
    const [updated] = await this.logQuery("update", async () => {
      return await this.dbInstance
        .update(this.table)
        .set(updateFields as any)
        .where(eq((this.table as any).id, id))
        .returning(selectColumns);
    });
    return updated as T["$inferSelect"];
  }

  /**
   * Upsert a record (insert or update on conflict)
   * @param data - Record data
   * @param options - Upsert options including conflict fields
   * @returns Promise with created or updated record
   */
  async upsert(
    data: T["$inferInsert"],
    options: UpsertOptions
  ): Promise<T["$inferSelect"]> {
    const { conflictFields, updateFields } = options;

    // Validate conflict fields exist
    for (const field of conflictFields) {
      this.validateFieldExists(field, "upsert conflictFields");
    }

    // Build conflict target
    const conflictTarget = conflictFields.map(
      (field) => (this.table as any)[field]
    );

    // Build update set - if updateFields specified, only update those, otherwise update all except conflict fields
    let updateSet: any = {};
    if (updateFields) {
      for (const field of updateFields) {
        this.validateFieldExists(field, "upsert updateFields");
        if (data[field as keyof typeof data] !== undefined) {
          updateSet[field] = data[field as keyof typeof data];
        }
      }
    } else {
      // Update all fields except conflict fields and system fields
      for (const [key, value] of Object.entries(data)) {
        if (
          !conflictFields.includes(key) &&
          !["id", "created_at", "deleted_at"].includes(key)
        ) {
          updateSet[key] = value;
        }
      }
    }

    // Use PostgreSQL ON CONFLICT
    const [result] = await this.logQuery("upsert", async () => {
      return await this.dbInstance
        .insert(this.table)
        .values(data)
        .onConflictDoUpdate({
          target: conflictTarget,
          set: updateSet,
        })
        .returning(this.visibleColumns);
    });

    return result as T["$inferSelect"];
  }

  /**
   * Delete a record (soft delete by default if supported)
   * @param id - Record ID
   * @param soft - Whether to soft delete (default: true)
   * @returns Promise with deleted record or null
   */
  async delete(
    id: number,
    soft = true,
    options?: { select?: string[] }
  ): Promise<T["$inferSelect"] | null> {
    const { select } = options || {};
    const hasDeletedAt = this.columns.deleted_at !== undefined;

    if (soft && hasDeletedAt) {
      // For soft delete, check that record exists and is not already deleted
      // Allow deleted_at to be selected since we're setting it
      const selectColumns = this.getSelectColumns(select, true);
      const deletedAtColumn = this.columns.deleted_at!; // Safe because hasDeletedAt is true
      const [deleted] = await this.logQuery("delete (soft)", async () => {
        return await this.dbInstance
          .update(this.table)
          .set({ deleted_at: new Date() })
          .where(and(eq((this.table as any).id, id), isNull(deletedAtColumn))!)
          .returning(selectColumns);
      });
      return deleted || null;
    } else {
      // Hard delete - first get the record, then delete
      // Include deleted records when getting for hard delete
      const selectColumns = this.getSelectColumns(select, true);
      const [toDelete] = await this.logQuery(
        "delete (hard - get)",
        async () => {
          return await this.baseQuery(
            this.dbInstance.select(selectColumns).from(this.table as any),
            true
          )
            .where(eq((this.table as any).id, id))
            .limit(1);
        }
      );

      if (!toDelete) {
        return null;
      }

      await this.logQuery("delete (hard - execute)", async () => {
        return await this.dbInstance
          .delete(this.table)
          .where(eq((this.table as any).id, id))
          .execute();
      });

      return toDelete as T["$inferSelect"];
    }
  }

  /**
   * Aggregate records with grouping and aggregation functions
   * @param options - Aggregation options
   * @returns Promise with aggregated results
   */
  async aggregate(options: AggregateOptions<T>): Promise<any[]> {
    const {
      filters,
      groupBy = [],
      aggregations,
      includeDeleted = false,
    } = options;

    // Validate groupBy fields
    for (const field of groupBy) {
      this.validateFieldExists(field, "groupBy");
    }

    // Validate aggregation fields
    for (const agg of aggregations) {
      this.validateFieldExists(agg.field, "aggregation field");
    }

    // Build select with aggregations
    const selectFields: Record<string, any> = {};

    // Add groupBy fields
    for (const field of groupBy) {
      selectFields[field] = (this.table as any)[field];
    }

    // Add aggregations
    for (const agg of aggregations) {
      const col = (this.table as any)[agg.field];
      const alias = agg.alias || `${agg.function}_${agg.field}`;

      switch (agg.function) {
        case "sum":
          selectFields[alias] = sql<number>`sum(${col})`.as(alias);
          break;
        case "avg":
          selectFields[alias] = sql<number>`avg(${col})`.as(alias);
          break;
        case "min":
          selectFields[alias] = sql<any>`min(${col})`.as(alias);
          break;
        case "max":
          selectFields[alias] = sql<any>`max(${col})`.as(alias);
          break;
        case "count":
          selectFields[alias] = sql<number>`count(${col})`.as(alias);
          break;
      }
    }

    let qb: any = this.dbInstance.select(selectFields).from(this.table as any);

    // Apply base query (soft delete filter)
    qb = this.baseQuery(qb, includeDeleted);

    // Apply filters using the new function (handles both object AND and array OR)
    if (filters) {
      const whereClauses = this.processFilters(filters);
      for (const clause of whereClauses) {
        qb = qb.where(clause);
      }
    }

    // Add groupBy
    if (groupBy.length > 0) {
      const groupByCols = groupBy.map((field) => (this.table as any)[field]);
      qb = qb.groupBy(...groupByCols) as any;
    }

    const results = await this.logQuery("aggregate", async () => await qb);
    return results;
  }

  /**
   * Execute operations within a database transaction
   * @param callback - Function that receives a transaction-scoped querybuilder instance
   * @returns Promise with the result of the callback
   */
  async transaction<TResult>(
    callback: (txQb: QueryBuilder<T>) => Promise<TResult>
  ): Promise<TResult> {
    // Use the existing dbInstance (which may already be a transaction)
    // or create a new transaction from the base db
    const baseDb = this.dbInstance === this.db ? this.db : this.dbInstance;

    return await baseDb.transaction(async (tx: DbType) => {
      // Create a new querybuilder instance with the transaction context
      const txQb = new QueryBuilder(this.table, {
        excludeColumns: this.excludeColumns,
        transaction: tx,
        queryLogger: this.queryLogger,
      });

      // Execute the callback with the transaction-scoped querybuilder
      return await callback(txQb);
    });
  }
}

// Factory function for backward compatibility
export function createQueryBuilder<T extends Table>(
  table: T,
  options: QueryBuilderOptions = {}
): QueryBuilder<T> {
  return new QueryBuilder(table, options);
}
