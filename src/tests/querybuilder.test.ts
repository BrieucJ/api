import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "@/db/client";
import { pgTable, text, integer, timestamp, vector } from "drizzle-orm/pg-core";
import { createQueryBuilder } from "@/db/querybuilder";
import { sql } from "drizzle-orm";
import { stringToVector } from "@/utils/encode";

/* ──────────────────────────────────────────────────────────────
   Test table definition
────────────────────────────────────────────────────────────── */
const testTable = pgTable("test_table", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  embedding: vector({ dimensions: 16 }),
});

const qb = createQueryBuilder(testTable);

/* ──────────────────────────────────────────────────────────────
   Setup
────────────────────────────────────────────────────────────── */
beforeAll(async () => {
  await db.execute(sql`DROP TABLE IF EXISTS test_table`);
  await db.execute(sql`
    CREATE TABLE test_table (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      embedding vector(16)
    )
  `);

  await db.insert(testTable).values([
    { name: "Alice", age: 30, embedding: stringToVector("Alice", 16) },
    { name: "Bob", age: 25, embedding: stringToVector("Bob", 16) },
    { name: "Charlie", age: 35, embedding: stringToVector("Charlie", 16) },
    { name: "Diana", age: 28, embedding: stringToVector("Diana", 16) },
    { name: "Eve", age: 40, embedding: stringToVector("Eve", 16) },
  ]);
});

/* ──────────────────────────────────────────────────────────────
   Operator matrix tests
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – operator matrix", () => {
  const cases = [
    // eq / ne
    { name: "eq string", filter: { name__eq: "Alice" }, expected: ["Alice"] },
    {
      name: "ne string",
      filter: { name__ne: "Alice" },
      expected: ["Bob", "Charlie", "Diana", "Eve"],
    },

    // gt / gte
    {
      name: "gt number",
      filter: { age__gt: 30 },
      expected: ["Charlie", "Eve"],
    },
    {
      name: "gte number",
      filter: { age__gte: 30 },
      expected: ["Alice", "Charlie", "Eve"],
    },

    // lt / lte
    {
      name: "lt number",
      filter: { age__lt: 30 },
      expected: ["Bob", "Diana"],
    },
    {
      name: "lte number",
      filter: { age__lte: 30 },
      expected: ["Alice", "Bob", "Diana"],
    },

    // in / notin
    {
      name: "in comma string",
      filter: { name__in: "Alice,Bob" },
      expected: ["Alice", "Bob"],
    },
    {
      name: "notin comma string",
      filter: { name__notin: "Alice,Bob" },
      expected: ["Charlie", "Diana", "Eve"],
    },

    // between / notbetween
    {
      name: "between numbers",
      filter: { age__between: "28,35" },
      expected: ["Alice", "Charlie", "Diana"],
    },
    {
      name: "notbetween numbers",
      filter: { age__notbetween: "28,35" },
      expected: ["Bob", "Eve"],
    },
  ];

  for (const tc of cases) {
    it(`supports ${tc.name}`, async () => {
      const res = await qb.list({ filters: tc.filter });

      const names = res.data.map((r) => r.name).sort();
      expect(names).toEqual(tc.expected.sort());
      expect(res.total).toBe(tc.expected.length);
    });
  }
});

/* ──────────────────────────────────────────────────────────────
   Timestamp-specific tests (fixes your crash)
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – timestamp operators", () => {
  it("supports between on timestamps", async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const res = await qb.list({
      filters: {
        created_at__between: `${yesterday.toISOString()},${now.toISOString()}`,
      },
    });

    expect(res.data.length).toBeGreaterThan(0);
  });

  it("supports gt / lt on timestamps", async () => {
    const now = new Date().toISOString();

    const res = await qb.list({
      filters: {
        created_at__lt: now,
      },
    });

    expect(res.data.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────────────────────
   Search + vector
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – search", () => {
  it("ranks nearest embedding first", async () => {
    const res = await qb.list({ search: "Ali" });

    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]?.name).toBe("Alice");
  });
});

/* ──────────────────────────────────────────────────────────────
   Pagination & ordering
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – pagination & ordering", () => {
  it("supports limit / offset / order", async () => {
    const res = await qb.list({
      limit: 2,
      offset: 1,
      order_by: "age",
      order: "desc",
    });

    expect(res.data.length).toBe(2);
    expect(res.data[0]?.age).toBe(35);
  });
});

/* ──────────────────────────────────────────────────────────────
   CRUD
────────────────────────────────────────────────────────────── */
describe("QueryBuilder – CRUD", () => {
  it("gets by id", async () => {
    const row = await qb.get(1);
    expect(row?.name).toBe("Alice");
  });

  it("creates row", async () => {
    const row = await qb.create({
      name: "Frank",
      age: 22,
      embedding: stringToVector("Frank", 16),
    });

    expect(row.id).toBeDefined();
    expect(row.name).toBe("Frank");
  });

  it("updates row", async () => {
    const row = await qb.update(1, { age: 31 });
    expect(row?.age).toBe(31);
  });

  it("soft deletes row", async () => {
    await qb.delete(1);

    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("hard deletes row", async () => {
    await qb.delete(2, false);

    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 2)).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────────────────
   Cleanup
────────────────────────────────────────────────────────────── */
afterAll(async () => {
  await db.execute(sql`DROP TABLE IF EXISTS test_table`);
});
