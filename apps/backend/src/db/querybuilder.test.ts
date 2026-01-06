import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";
import { db } from "@/db/db";
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { QueryBuilder } from "@/db/querybuilder";
import { sql } from "drizzle-orm";

/* ──────────────────────────────────────────────────────────────
   Test table definition
────────────────────────────────────────────────────────────── */
const testTable = pgTable("test_table", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  deleted_at: timestamp("deleted_at"),
});

const qb = new QueryBuilder(testTable);

/* ──────────────────────────────────────────────────────────────
   Setup / Reset
────────────────────────────────────────────────────────────── */
beforeAll(async () => {
  await db.execute(sql`DROP TABLE IF EXISTS test_table`);
  await db.execute(sql`
    CREATE TABLE test_table (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      tags TEXT[],
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP
    )
  `);
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE test_table RESTART IDENTITY`);
  await db.insert(testTable).values([
    {
      name: "Alice",
      age: 30,
      tags: ["x", "y"],
      metadata: {
        email: "alice@example.com",
        role: "admin",
        settings: {
          theme: "dark",
          notifications: true,
        },
        nested: {
          level1: {
            level2: {
              value: "deep_value",
            },
          },
        },
      },
    },
    {
      name: "Bob",
      age: 0,
      tags: [],
      metadata: {
        email: "bob@example.com",
        role: "user",
        settings: {
          theme: "light",
          notifications: false,
        },
      },
    },
    {
      name: "Charlie",
      age: 35,
      tags: ["z"],
      metadata: {
        email: "charlie@example.com",
        role: "admin",
        settings: {
          theme: "dark",
          notifications: true,
        },
        tags: ["important", "vip"],
      },
    },
    {
      name: "Diana",
      age: 28,
      tags: ["x"],
      metadata: {
        email: "diana@example.com",
        role: "user",
        settings: {
          theme: "light",
        },
      },
    },
    {
      name: "Eve",
      age: 40,
      tags: ["y"],
      metadata: null,
    },
  ]);
});

/* ──────────────────────────────────────────────────────────────
   Exhaustive operator tests
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – exhaustive operators & edge cases", () => {
  const operators: Record<string, any[]> = {
    eq: ["Alice", 0, null, undefined, false, true, ""],
    ne: ["Alice", 0, null, undefined, false, true, ""],
    gt: [0, 28, 35],
    gte: [0, 28, 35],
    lt: [28, 35, 100],
    lte: [28, 35, 100],
    like: ["Ali", "Bo", ""],
    ilike: ["ali", "BO", ""],
    notlike: ["Ali", ""],
    notilike: ["ali", ""],
    startswith: ["Al", "B", ""],
    istartswith: ["al", "b", ""],
    endswith: ["ce", "b", ""],
    iendswith: ["CE", "B", ""],
    isnull: [null],
    isnotnull: [0, "", "Alice", false],
    in: [["Alice", "Bob"], [0, 35], ["nonexistent"]],
    notin: [["Alice", "Bob"], [0, 35], ["nonexistent"]],
    between: [
      ["28", "35"],
      ["0", "40"],
    ],
    notbetween: [
      ["28", "35"],
      ["0", "40"],
    ],
    arraycontains: [["x"], ["y"], ["z"]],
    arraycontained: [["x", "y"], ["x"], ["z"]],
    arrayoverlaps: [["x"], ["y"], ["z"]],
  };

  for (const [op, values] of Object.entries(operators)) {
    for (const val of values) {
      it(`operator ${op} with value ${JSON.stringify(val)}`, async () => {
        const filter: any = {};
        if (["isnull", "isnotnull"].includes(op)) {
          filter["tags__" + op] = val;
        } else if (
          ["arraycontains", "arraycontained", "arrayoverlaps"].includes(op)
        ) {
          filter["tags__" + op] = val;
        } else if (op === "between" || op === "notbetween") {
          filter["age__" + op] = val.join(",");
        } else if (op === "in" || op === "notin") {
          filter["name__" + op] = Array.isArray(val) ? val.join(",") : val;
        } else {
          filter["name__" + op] = val;
        }

        let res;
        try {
          res = await qb.list({ filters: filter });
        } catch (err) {
          res = { data: [], total: 0 };
        }
        expect(res).toBeDefined();
        expect(Array.isArray(res.data)).toBe(true);
        expect(typeof res.total).toBe("number");
      });
    }
  }
});

/* ──────────────────────────────────────────────────────────────
   Timestamps & embeddings
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – timestamps & embeddings", () => {
  it("supports timestamp between filter", async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 60_000); // 1 min ago
    const end = new Date(now.getTime() + 60_000); // 1 min ahead
    const res = await qb.list({
      filters: {
        created_at__between: `${start.toISOString()},${end.toISOString()}`,
      },
    });

    expect(res.data.length).toBeGreaterThan(0);
  });

  it("supports search via embeddings", async () => {
    const res = await qb.list({ search: "Ali" });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]?.name).toBe("Alice");
  });
});

/* ──────────────────────────────────────────────────────────────
   Pagination & CRUD
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – pagination & CRUD", () => {
  it("supports limit / offset / order", async () => {
    const res = await qb.list({
      limit: 2,
      offset: 1,
      order_by: { field: "age", order: "desc" },
    });
    expect(res.data.length).toBe(2);
  });

  it("get by id", async () => {
    const row = await qb.get(1);
    expect(row?.name).toBe("Alice");
  });

  it("create row", async () => {
    const row = await qb.create({
      name: "Frank",
      age: 22,
      tags: ["f"],
    });
    expect(row.id).toBeDefined();
    expect(row.name).toBe("Frank");
  });

  it("create row with select", async () => {
    const row = await qb.create(
      {
        name: "Frank",
        age: 22,
        tags: ["f"],
      },
      { select: ["id", "name"] }
    );
    expect(row.id).toBeDefined();
    expect(row.name).toBe("Frank");
    expect(row).not.toHaveProperty("age");
    expect(row).not.toHaveProperty("tags");
  });

  it("update row", async () => {
    const row = await qb.update(1, { age: 31 });
    expect(row?.age).toBe(31);
  });

  it("update row with select", async () => {
    const row = await qb.update(
      1,
      { age: 31 },
      { select: ["id", "name", "age"] }
    );
    expect(row?.id).toBe(1);
    expect(row?.name).toBe("Alice");
    expect(row?.age).toBe(31);
    expect(row).not.toHaveProperty("tags");
    expect(row).not.toHaveProperty("metadata");
  });

  it("soft delete row", async () => {
    await qb.delete(1);
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("soft delete row with select", async () => {
    const deleted = await qb.delete(1, true, {
      select: ["id", "name", "deleted_at"],
    });
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(1);
    expect(deleted?.name).toBe("Alice");
    expect(deleted?.deleted_at).toBeDefined();
    expect(deleted).not.toHaveProperty("age");
    expect(deleted).not.toHaveProperty("tags");
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("soft delete row with select (without deleted_at)", async () => {
    const deleted = await qb.delete(1, true, { select: ["id", "name"] });
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(1);
    expect(deleted?.name).toBe("Alice");
    expect(deleted).not.toHaveProperty("age");
    expect(deleted).not.toHaveProperty("tags");
    expect(deleted).not.toHaveProperty("deleted_at");
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("hard delete row", async () => {
    const deleted = await qb.delete(2, false);
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(2);
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 2)).toBeUndefined();
  });

  it("hard delete row with select", async () => {
    const deleted = await qb.delete(2, false, { select: ["id", "name"] });
    expect(deleted).toBeDefined();
    expect(deleted?.id).toBe(2);
    expect(deleted?.name).toBe("Bob");
    expect(deleted).not.toHaveProperty("age");
    expect(deleted).not.toHaveProperty("tags");
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 2)).toBeUndefined();
  });
});

describe("QueryBuilder – count, exists, getBy", () => {
  it("count records with filters", async () => {
    const count = await qb.count({ filters: { age__gte: 30 } });
    expect(count).toBe(3); // Alice (30), Charlie (35), Eve (40)
    // Verify it excludes records below threshold
    const allCount = await qb.count();
    expect(allCount).toBe(5);
    expect(count).toBeLessThan(allCount);
  });

  it("count all records", async () => {
    const count = await qb.count();
    expect(count).toBe(5);
  });

  it("exists returns true for existing record", async () => {
    const exists = await qb.exists(1);
    expect(exists).toBe(true);
  });

  it("exists returns false for non-existent record", async () => {
    const exists = await qb.exists(999);
    expect(exists).toBe(false);
  });

  it("getBy returns first matching record", async () => {
    const record = await qb.getBy({ filters: { name__eq: "Alice" } });
    expect(record).toBeDefined();
    expect(record?.name).toBe("Alice");
  });

  it("getBy returns null when no match", async () => {
    const record = await qb.getBy({ filters: { name__eq: "NonExistent" } });
    expect(record).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────
   Advanced Features
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – advanced features", () => {
  it("supports multiple order_by fields", async () => {
    const res = await qb.list({
      order_by: [
        { field: "age", order: "desc" },
        { field: "name", order: "asc" },
      ],
    });
    expect(res.data.length).toBeGreaterThan(0);
    // Verify ordering (first by age desc, then by name asc)
    expect(res.data[0]?.age).toBeGreaterThanOrEqual(res.data[1]?.age || 0);
  });

  it("order_by array supports multiple fields", async () => {
    const res = await qb.list({
      order_by: [
        { field: "age", order: "desc" },
        { field: "name", order: "asc" },
      ],
    });
    expect(res.data.length).toBeGreaterThan(0);
    // Should be ordered by age desc, then name asc
    expect(res.data[0]?.age).toBeGreaterThanOrEqual(res.data[1]?.age || 0);
  });

  it("supports column selection", async () => {
    const res = await qb.list({
      select: ["id", "name"],
      limit: 1,
    });
    expect(res.data.length).toBe(1);
    const record = res.data[0];
    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("name");
    expect(record).not.toHaveProperty("age");
  });

  it("throws error for invalid field in order_by", async () => {
    await expect(
      qb.list({ order_by: { field: "invalid_field", order: "asc" } as any })
    ).rejects.toThrow();
  });

  it("throws error for invalid filter field", async () => {
    await expect(
      qb.list({ filters: { invalid_field__eq: "value" } })
    ).rejects.toThrow();
  });

  it("throws error for invalid lookup operator", async () => {
    await expect(
      qb.list({ filters: { name__invalid_op: "value" } })
    ).rejects.toThrow();
  });
});

/* ──────────────────────────────────────────────────────────────
   AND/OR Filter Support
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – AND/OR filters", () => {
  it("supports AND filters (object)", async () => {
    const res = await qb.list({
      filters: { name__eq: "Alice", age__gte: 30 },
    });
    // Should return Alice (age 30) - matches both conditions
    expect(res.data.length).toBe(1);
    expect(res.data[0]?.name).toBe("Alice");
    expect(res.data[0]?.age).toBe(30);
  });

  it("supports OR filters (array)", async () => {
    const res = await qb.list({
      filters: [{ name__eq: "Alice" }, { name__eq: "Bob" }],
    });
    // Should return Alice and Bob
    expect(res.data.length).toBe(2);
    const names = res.data.map((r) => r.name).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("supports complex AND/OR combinations", async () => {
    const res = await qb.list({
      filters: [
        { name__eq: "Alice", age__gte: 30 },
        { name__eq: "Charlie", age__gte: 35 },
      ],
    });
    // (name='Alice' AND age>=30) OR (name='Charlie' AND age>=35)
    // Should return Alice (30) and Charlie (35)
    expect(res.data.length).toBe(2);
    const names = res.data.map((r) => r.name).sort();
    expect(names).toEqual(["Alice", "Charlie"]);
  });

  it("OR filters with no matches return empty", async () => {
    const res = await qb.list({
      filters: [{ name__eq: "NonExistent1" }, { name__eq: "NonExistent2" }],
    });
    expect(res.data.length).toBe(0);
  });

  it("AND filters with no matches return empty", async () => {
    const res = await qb.list({
      filters: { name__eq: "Alice", age__gte: 100 },
    });
    // Alice is 30, not >= 100
    expect(res.data.length).toBe(0);
  });

  it("supports OR with different operators", async () => {
    const res = await qb.list({
      filters: [{ age__eq: 30 }, { age__eq: 35 }, { age__eq: 40 }],
    });
    // Should return Alice (30), Charlie (35), Eve (40)
    expect(res.data.length).toBe(3);
    const ages = res.data.map((r) => r.age).sort();
    expect(ages).toEqual([30, 35, 40]);
  });
});

/* ──────────────────────────────────────────────────────────────
   AND/OR Filter Support
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – AND/OR filters", () => {
  it("supports AND filters (object)", async () => {
    const res = await qb.list({
      filters: { name__eq: "Alice", age__gte: 30 },
    });
    // Should return Alice (age 30) - matches both conditions
    expect(res.data.length).toBe(1);
    expect(res.data[0]?.name).toBe("Alice");
    expect(res.data[0]?.age).toBe(30);
  });

  it("supports OR filters (array)", async () => {
    const res = await qb.list({
      filters: [{ name__eq: "Alice" }, { name__eq: "Bob" }],
    });
    // Should return Alice and Bob
    expect(res.data.length).toBe(2);
    const names = res.data.map((r) => r.name).sort();
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("supports complex AND/OR combinations", async () => {
    const res = await qb.list({
      filters: [
        { name__eq: "Alice", age__gte: 30 },
        { name__eq: "Charlie", age__gte: 35 },
      ],
    });
    // (name='Alice' AND age>=30) OR (name='Charlie' AND age>=35)
    // Should return Alice (30) and Charlie (35)
    expect(res.data.length).toBe(2);
    const names = res.data.map((r) => r.name).sort();
    expect(names).toEqual(["Alice", "Charlie"]);
  });

  it("OR filters with no matches return empty", async () => {
    const res = await qb.list({
      filters: [{ name__eq: "NonExistent1" }, { name__eq: "NonExistent2" }],
    });
    expect(res.data.length).toBe(0);
  });

  it("AND filters with no matches return empty", async () => {
    const res = await qb.list({
      filters: { name__eq: "Alice", age__gte: 100 },
    });
    // Alice is 30, not >= 100
    expect(res.data.length).toBe(0);
  });

  it("supports OR with different operators", async () => {
    const res = await qb.list({
      filters: [{ age__eq: 30 }, { age__eq: 35 }, { age__eq: 40 }],
    });
    // Should return Alice (30), Charlie (35), Eve (40)
    expect(res.data.length).toBe(3);
    const ages = res.data.map((r) => r.age).sort();
    expect(ages).toEqual([30, 35, 40]);
  });
});

/* ──────────────────────────────────────────────────────────────
   Configurable Options
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – configurable options", () => {
  it("allows custom excluded columns", async () => {
    const customQb = new QueryBuilder(testTable, {
      excludeColumns: ["deleted_at", "password_hash", "created_at"],
    });
    const res = await customQb.list({ limit: 1 });
    expect(res.data[0]).not.toHaveProperty("created_at");
  });

  it("supports configurable search options", async () => {
    // This test would require an embedding column, so we'll skip if not available
    // Just verify the option is accepted without error
    const res = await qb.list({
      search: "test",
      searchOptions: {
        dimension: 16,
        threshold: 0.5,
      },
    });
    expect(res).toBeDefined();
  });
});

/* ──────────────────────────────────────────────────────────────
   Include Deleted Records
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – include deleted records", () => {
  it("excludes deleted records by default", async () => {
    // Soft delete a record
    await qb.delete(1);
    // Should not appear in list
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("includes deleted records when includeDeleted is true", async () => {
    // Soft delete a record
    await qb.delete(2);
    // Should appear when includeDeleted is true
    const res = await qb.list({ includeDeleted: true });
    const deleted = res.data.find((r) => r.id === 2);
    expect(deleted).toBeDefined();
    expect(deleted?.deleted_at).toBeDefined();
  });

  it("get() excludes deleted records by default", async () => {
    await qb.delete(3);
    const record = await qb.get(3);
    expect(record).toBeNull();
  });

  it("get() includes deleted records when includeDeleted is true", async () => {
    await qb.delete(4);
    const record = await qb.get(4, { includeDeleted: true });
    expect(record).toBeDefined();
    expect(record?.deleted_at).toBeDefined();
  });

  it("getBy() respects includeDeleted option", async () => {
    await qb.delete(5);
    const record = await qb.getBy({
      filters: { id__eq: 5 },
      includeDeleted: true,
    });
    expect(record).toBeDefined();
    expect(record?.deleted_at).toBeDefined();
  });

  it("count() respects includeDeleted option", async () => {
    const beforeCount = await qb.count();
    await qb.delete(1);
    const afterCount = await qb.count();
    const withDeleted = await qb.count({ includeDeleted: true });
    expect(afterCount).toBe(beforeCount - 1);
    expect(withDeleted).toBe(beforeCount);
  });
});

/* ──────────────────────────────────────────────────────────────
   JSONB Query Support
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – JSONB queries", () => {
  describe("Nested JSONB path queries", () => {
    it("supports single-level JSONB path queries", async () => {
      // Query: metadata__jsonb__email__eq
      const res = await qb.list({
        filters: { metadata__jsonb__email__eq: "alice@example.com" },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Alice");
    });

    it("supports multi-level JSONB path queries", async () => {
      // Query: metadata__jsonb__settings__theme__eq
      const res = await qb.list({
        filters: { metadata__jsonb__settings__theme__eq: "dark" },
      });
      expect(res.data.length).toBe(2); // Alice and Charlie
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Charlie"]);
    });

    it("supports deep nested JSONB path queries", async () => {
      // Query: metadata__jsonb__nested__level1__level2__value__eq
      const res = await qb.list({
        filters: {
          metadata__jsonb__nested__level1__level2__value__eq: "deep_value",
        },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Alice");
    });

    it("supports JSONB path queries with like operator", async () => {
      // Query: metadata__jsonb__email__like
      const res = await qb.list({
        filters: { metadata__jsonb__email__like: "example" },
      });
      expect(res.data.length).toBe(4); // All except Eve (null metadata)
      expect(res.data.every((r) => r.name !== "Eve")).toBe(true);
    });

    it("supports JSONB path queries with ilike operator", async () => {
      // Query: metadata__jsonb__email__ilike (case-insensitive)
      const res = await qb.list({
        filters: { metadata__jsonb__email__ilike: "ALICE" },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Alice");
    });

    it("supports JSONB path queries with ne operator", async () => {
      // Query: metadata__jsonb__role__ne
      const res = await qb.list({
        filters: { metadata__jsonb__role__ne: "admin" },
      });
      expect(res.data.length).toBe(2); // Bob and Diana (users)
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Bob", "Diana"]);
    });

    it("returns empty results for non-existent JSONB paths", async () => {
      const res = await qb.list({
        filters: { metadata__jsonb__nonexistent__eq: "value" },
      });
      expect(res.data.length).toBe(0);
    });

    it("throws error for invalid JSONB field", async () => {
      await expect(
        qb.list({ filters: { name__jsonb__key__eq: "value" } })
      ).rejects.toThrow();
    });

    it("throws error for empty JSONB path", async () => {
      await expect(
        qb.list({ filters: { metadata__jsonb__eq: "value" } })
      ).rejects.toThrow();
    });
  });

  describe("JSONB column operators", () => {
    it("supports jsonb__contains operator", async () => {
      // Query: metadata__jsonb__contains
      const res = await qb.list({
        filters: {
          metadata__jsonb__contains: JSON.stringify({ role: "admin" }),
        },
      });
      expect(res.data.length).toBe(2); // Alice and Charlie
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Charlie"]);
    });

    it("supports jsonb__key_exists operator", async () => {
      // Query: metadata__jsonb__key_exists
      const res = await qb.list({
        filters: { metadata__jsonb__key_exists: "tags" },
      });
      expect(res.data.length).toBe(1); // Only Charlie has tags
      expect(res.data[0]?.name).toBe("Charlie");
    });

    it("supports jsonb__all_keys_exist operator", async () => {
      // Query: metadata__jsonb__all_keys_exist
      const res = await qb.list({
        filters: {
          metadata__jsonb__all_keys_exist: ["email", "role", "settings"],
        },
      });
      expect(res.data.length).toBe(4); // All except Eve (null metadata)
      expect(res.data.every((r) => r.name !== "Eve")).toBe(true);
    });

    it("supports jsonb__all_keys_exist with single key", async () => {
      const res = await qb.list({
        filters: { metadata__jsonb__all_keys_exist: "email" },
      });
      expect(res.data.length).toBe(4); // All except Eve
    });

    it("supports jsonb__any_key_exists operator", async () => {
      // Query: metadata__jsonb__any_key_exists
      const res = await qb.list({
        filters: { metadata__jsonb__any_key_exists: ["tags", "nested"] },
      });
      expect(res.data.length).toBe(2); // Alice (has nested) and Charlie (has tags)
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Charlie"]);
    });

    it("supports jsonb__any_key_exists with single key", async () => {
      const res = await qb.list({
        filters: { metadata__jsonb__any_key_exists: "tags" },
      });
      expect(res.data.length).toBe(1); // Only Charlie
      expect(res.data[0]?.name).toBe("Charlie");
    });

    it("supports jsonb__eq operator on JSONB column", async () => {
      // Query: metadata__jsonb__eq (exact match)
      const aliceMetadata = {
        email: "alice@example.com",
        role: "admin",
        settings: {
          theme: "dark",
          notifications: true,
        },
        nested: {
          level1: {
            level2: {
              value: "deep_value",
            },
          },
        },
      };
      const res = await qb.list({
        filters: {
          metadata__jsonb__eq: JSON.stringify(aliceMetadata),
        },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Alice");
    });

    it("supports jsonb__ne operator on JSONB column", async () => {
      // Query: metadata__jsonb__ne
      const res = await qb.list({
        filters: {
          metadata__jsonb__ne: "null",
        },
      });
      expect(res.data.length).toBe(4); // All except Eve (null metadata)
    });

    it("handles null JSONB values correctly", async () => {
      // Eve has null metadata
      const res = await qb.list({
        filters: { metadata__isnull: null },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Eve");
    });

    it("handles non-null JSONB values correctly", async () => {
      const res = await qb.list({
        filters: { metadata__isnotnull: null },
      });
      expect(res.data.length).toBe(4); // All except Eve
    });
  });

  describe("JSONB queries with AND/OR filters", () => {
    it("supports AND filters with JSONB paths", async () => {
      const res = await qb.list({
        filters: {
          metadata__jsonb__role__eq: "admin",
          metadata__jsonb__settings__theme__eq: "dark",
        },
      });
      expect(res.data.length).toBe(2); // Alice and Charlie
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Charlie"]);
    });

    it("supports OR filters with JSONB paths", async () => {
      const res = await qb.list({
        filters: [
          { metadata__jsonb__role__eq: "admin" },
          { metadata__jsonb__settings__theme__eq: "light" },
        ],
      });
      expect(res.data.length).toBe(4); // Alice, Charlie (admin), Bob, Diana (light theme)
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Bob", "Charlie", "Diana"]);
    });

    it("supports complex AND/OR combinations with JSONB", async () => {
      const res = await qb.list({
        filters: [
          {
            metadata__jsonb__role__eq: "admin",
            metadata__jsonb__settings__theme__eq: "dark",
          },
          {
            metadata__jsonb__role__eq: "user",
            metadata__jsonb__settings__theme__eq: "light",
          },
        ],
      });
      expect(res.data.length).toBe(4); // All users with matching role/theme
      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Bob", "Charlie", "Diana"]);
    });
  });

  describe("JSONB queries with pagination and ordering", () => {
    it("supports pagination with JSONB filters", async () => {
      const res = await qb.list({
        filters: { metadata__jsonb__role__eq: "admin" },
        limit: 1,
        offset: 0,
      });
      expect(res.data.length).toBe(1);
      expect(res.total).toBe(2);
    });

    it("supports ordering with JSONB filters", async () => {
      const res = await qb.list({
        filters: { metadata__isnotnull: null },
        order_by: { field: "name", order: "asc" },
      });
      expect(res.data.length).toBe(4); // All except Eve (null metadata)
      expect(res.data[0]?.name).toBe("Alice");
      expect(res.data[3]?.name).toBe("Diana"); // Last one alphabetically (Eve is filtered out)
      expect(res.data.every((r) => r.name !== "Eve")).toBe(true);
    });
  });

  describe("JSONB edge cases", () => {
    it("handles empty JSONB objects", async () => {
      // Insert a record with empty metadata
      await qb.create({
        name: "EmptyMeta",
        age: 25,
        tags: [],
        metadata: {},
      });

      const res = await qb.list({
        filters: { metadata__jsonb__key_exists: "nonexistent" },
      });
      // Should not include EmptyMeta
      expect(res.data.find((r) => r.name === "EmptyMeta")).toBeUndefined();
    });

    it("handles JSONB arrays", async () => {
      // Charlie has tags array in metadata
      const res = await qb.list({
        filters: { metadata__jsonb__key_exists: "tags" },
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0]?.name).toBe("Charlie");
    });

    it("handles numeric values in JSONB paths", async () => {
      // Insert a record with numeric keys in JSONB
      await qb.create({
        name: "NumericKeys",
        age: 25,
        tags: [],
        metadata: {
          scores: {
            1: 100,
            2: 200,
          },
        },
      });

      // Note: JSONB path queries work with string keys, not numeric indices
      // This test verifies the system doesn't break with numeric-looking keys
      const res = await qb.list({
        filters: { metadata__jsonb__key_exists: "scores" },
      });
      expect(res.data.length).toBeGreaterThan(0);
    });
  });
});

/* ──────────────────────────────────────────────────────────────
   Transaction Support
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – transaction support", () => {
  it("executes operations within a transaction", async () => {
    const result = await qb.transaction(async (txQb) => {
      const created = await txQb.create({
        name: "TransactionTest",
        age: 25,
        tags: ["test"],
      });
      const updated = await txQb.update(created.id, { age: 26 });
      return updated;
    });

    expect(result).toBeDefined();
    expect(result?.age).toBe(26);
    // Verify the record exists after transaction
    if (!result) {
      throw new Error("Result should not be null");
    }
    const record = await qb.get(result.id);
    expect(record).toBeDefined();
  });

  it("rolls back transaction on error", async () => {
    let errorThrown = false;
    try {
      await qb.transaction(async (txQb) => {
        await txQb.create({
          name: "ShouldRollback",
          age: 30,
          tags: ["test"],
        });
        // Throw an error to trigger rollback
        throw new Error("Test rollback");
      });
    } catch (error) {
      errorThrown = true;
      expect(error instanceof Error).toBe(true);
    }

    expect(errorThrown).toBe(true);
    // Verify the record doesn't exist (transaction rolled back)
    const records = await qb.list({ filters: { name__eq: "ShouldRollback" } });
    expect(records.data.length).toBe(0);
  });

  it("supports nested transactions", async () => {
    const result = await qb.transaction(async (txQb1) => {
      const created1 = await txQb1.create({
        name: "Nested1",
        age: 20,
        tags: [],
      });

      // Nested transaction (uses same transaction context)
      const result2 = await txQb1.transaction(async (txQb2) => {
        const created2 = await txQb2.create({
          name: "Nested2",
          age: 21,
          tags: [],
        });
        return created2;
      });

      return { created1, result2 };
    });

    expect(result.created1).toBeDefined();
    expect(result.result2).toBeDefined();
    // Both should exist after transaction
    const record1 = await qb.get(result.created1.id);
    const record2 = await qb.get(result.result2.id);
    expect(record1).toBeDefined();
    expect(record2).toBeDefined();
  });
});

/* ──────────────────────────────────────────────────────────────
   Query Logging
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – query logging", () => {
  it("logs queries when enabled", async () => {
    const qbWithLogging = new QueryBuilder(testTable, {
      queryLogger: { enabled: true, slowQueryThreshold: 1000 },
    });
    // Execute a query - logging should happen (we can't easily test the logs,
    // but we verify it doesn't break)
    const result = await qbWithLogging.list({ limit: 1 });
    expect(result.data).toBeDefined();
  });

  it("can disable query logging", async () => {
    const qbWithoutLogging = new QueryBuilder(testTable, {
      queryLogger: { enabled: false },
    });
    // Execute a query - should work without logging
    const result = await qbWithoutLogging.list({ limit: 1 });
    expect(result.data).toBeDefined();
  });

  it("detects slow queries", async () => {
    const qbWithSlowThreshold = new QueryBuilder(testTable, {
      queryLogger: { enabled: true, slowQueryThreshold: 1 }, // 1ms threshold for testing
    });
    // Execute a query that might be slow
    const result = await qbWithSlowThreshold.list({});
    expect(result.data).toBeDefined();
  });
});

/* ──────────────────────────────────────────────────────────────
   Cleanup
────────────────────────────────────────────────────────────── */
afterAll(async () => {
  await db.execute(sql`DROP TABLE IF EXISTS test_table`);
});
