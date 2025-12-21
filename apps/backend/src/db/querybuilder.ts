import { db } from "@/db/db";
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
  type Column,
  type SQL,
} from "drizzle-orm";
import {
  PgTimestamp,
  PgDate,
  PgInteger,
  PgBigInt53,
  PgBoolean,
} from "drizzle-orm/pg-core";
import { stringToVector, generateRowEmbedding } from "@/utils/encode";

type Col = Column<any>;
type Val = unknown;

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

export function createQueryBuilder<T extends Table>(table: T) {
  const columnsToExclude = ["embedding", "deleted_at"];
  const columns = getTableColumns(table);
  const colNames = Object.keys(columns);
  const baseQuery = (qb: any) => {
    // global filter: soft delete
    // Fix: Check if deleted_at column exists in columns, not on table object
    if (columns.deleted_at) {
      qb = qb.where(isNull(columns.deleted_at));
    }
    return qb;
  };

  const visibleColumns = Object.fromEntries(
    Object.entries(columns).filter(([key]) => !columnsToExclude.includes(key))
  ) as typeof columns;

  return {
    list: async (options: {
      filters?: Record<string, any>;
      search?: string;
      limit?: number;
      offset?: number;
      order_by?: string;
      order?: "asc" | "desc";
    }): Promise<{ data: T["$inferSelect"][]; total: number }> => {
      const {
        filters = {},
        search,
        limit = 20,
        offset = 0,
        order_by = "id",
        order = "asc",
      } = options;

      let qb = baseQuery(db.select(visibleColumns).from(table as any));
      let countQb = baseQuery(
        db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(table as any)
      );

      let whereClauses: SQL[] = [];

      for (const [rawKey, rawValue] of Object.entries(filters)) {
        const parts = rawKey.toLowerCase().split("__");
        const field = parts[0]!;
        const lookup = parts[1] ?? "eq";
        if (!colNames.includes(field)) continue;

        const col = columns[field];
        if (!col) continue;

        const value = castFilterValue(col, lookup, rawValue);
        const operator = LOOKUP_MAP[lookup];
        if (!operator) continue;

        whereClauses.push(operator(col, value));
      }

      for (const clause of whereClauses) {
        qb = qb.where(clause);
        countQb = countQb.where(clause);
      }

      // Hybrid search: Combine keyword (text) search with vector (semantic) search
      if (search && columns.embedding) {
        const searchVector = stringToVector(search, 16);
        const distance = cosineDistance(columns.embedding, searchVector);
        const searchPattern = `%${search}%`;

        // Find text-searchable columns (message, source, level for logs)
        const textSearchableColumns: Column<any>[] = [];
        if (columns.message) textSearchableColumns.push(columns.message);
        if (columns.source) textSearchableColumns.push(columns.source);
        if (columns.level) textSearchableColumns.push(columns.level);

        // Build keyword search conditions (ILIKE for case-insensitive)
        // Use OR to combine multiple column searches
        const keywordConditions: SQL[] = [];
        for (const col of textSearchableColumns) {
          keywordConditions.push(ilike(col, searchPattern));
        }
        const keywordSearch =
          keywordConditions.length > 0 ? or(...keywordConditions)! : sql`false`;

        // Get candidates with both keyword match score and vector distance
        // Score: 0 = keyword match, 1 = vector distance (lower is better)
        const candidateQb = baseQuery(
          db
            .select({
              ...visibleColumns,
              hasKeywordMatch: sql<boolean>`${keywordSearch}`.as(
                "has_keyword_match"
              ),
              vectorDistance: distance.as("vector_distance"),
            })
            .from(table as any)
        );

        // Apply existing filters
        for (const clause of whereClauses) {
          candidateQb.where(clause);
        }

        // Get more candidates than needed for better ranking
        const candidates = (await candidateQb.limit(
          Math.max(limit * 3, 100)
        )) as Array<
          T["$inferSelect"] & {
            hasKeywordMatch: boolean;
            vectorDistance: number;
          }
        >;

        if (candidates.length === 0) {
          return { data: [], total: 0 };
        }

        // Rank and filter results:
        // 1. Keyword matches first (exact/partial text matches)
        // 2. Then vector similarity (semantic matches)
        // 3. Only return if there are meaningful matches
        const keywordMatches = candidates.filter((c) => c.hasKeywordMatch);
        const vectorMatches = candidates
          .filter((c) => !c.hasKeywordMatch) // Don't duplicate keyword matches
          .sort((a, b) => a.vectorDistance - b.vectorDistance); // Sort by distance

        // Combine: keyword matches first, then best vector matches
        // Only include vector matches if they're reasonably similar (distance < 1.0)
        const relevantVectorMatches = vectorMatches.filter(
          (c) => c.vectorDistance < 0.6
        );

        const combinedResults = [
          ...keywordMatches,
          ...relevantVectorMatches.slice(
            0,
            Math.max(0, limit - keywordMatches.length)
          ),
        ].slice(0, limit);

        // Remove computed fields
        const finalResults = combinedResults.map(
          ({ hasKeywordMatch: _, vectorDistance: __, ...item }) => item
        ) as T["$inferSelect"][];

        // Count total relevant results (keyword + reasonable vector matches)
        const countQb = baseQuery(
          db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(table as any)
        );

        for (const clause of whereClauses) {
          countQb.where(clause);
        }

        // Count: keyword matches OR vector matches with distance < 1.0
        countQb.where(or(keywordSearch, sql`${distance} < 1.0`)!);

        const [countRow] = await countQb;

        return {
          data: finalResults,
          total: countRow?.count || 0,
        };
      } else {
        // When not searching, use the default ordering
        const orderFn = order === "asc" ? asc : desc;
        qb = qb.orderBy(orderFn((table as any)[order_by]));
      }

      qb = qb.limit(limit).offset(offset);

      const [totalRow] = await countQb;
      const items = await qb;

      return {
        data: items as T["$inferSelect"][],
        total: totalRow?.count || 0,
      };
    },

    get: async (id: number): Promise<T["$inferSelect"] | null> => {
      const [item] = await baseQuery(
        db.select(visibleColumns).from(table as any)
      )
        .where(eq((table as any).id, id))
        .limit(1);
      return (item as T["$inferSelect"]) || null;
    },

    create: async (data: T["$inferInsert"]): Promise<T["$inferSelect"]> => {
      const [created] = await db
        .insert(table)
        .values({
          ...data,
          embedding: generateRowEmbedding(data),
        })
        .returning(visibleColumns);
      return created as T["$inferSelect"];
    },

    update: async (
      id: number,
      data: Partial<T["$inferInsert"]>
    ): Promise<T["$inferSelect"] | null> => {
      const existing = await db
        .select()
        .from(table as any)
        .where(eq((table as any).id, id))
        .limit(1);
      if (!existing[0]) return null;

      const mergedData = { ...existing[0], ...data };
      const {
        id: _ignored,
        created_at,
        deleted_at,
        updated_at,
        ...safeData
      } = mergedData;

      const updatedData = {
        ...safeData,
        embedding: generateRowEmbedding(mergedData),
      };

      const [updated] = await db
        .update(table)
        .set(updatedData)
        .where(eq((table as any).id, id))
        .returning(visibleColumns);
      return (updated as T["$inferSelect"]) || null;
    },

    delete: async (
      id: number,
      soft = true
    ): Promise<T["$inferSelect"] | { id: number } | null> => {
      // Fix: Check if deleted_at column exists in columns, not on table object
      const hasDeletedAt = columns.deleted_at !== undefined;

      if (soft && hasDeletedAt) {
        const [deleted] = await db
          .update(table)
          .set({ deleted_at: new Date() })
          .where(eq((table as any).id, id))
          .returning(visibleColumns);
        return deleted || null;
      } else {
        const deleted = await db
          .delete(table)
          .where(eq((table as any).id, id))
          .execute();
        return deleted ? { id } : null;
      }
    },
  };
}
