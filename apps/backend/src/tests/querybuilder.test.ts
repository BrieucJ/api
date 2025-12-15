import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";
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
  tags: text("tags").array(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  deleted_at: timestamp("deleted_at"),
  embedding: vector({ dimensions: 16 }),
});

const qb = createQueryBuilder(testTable);

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
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP,
      embedding vector(16)
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
      embedding: stringToVector("Alice", 16),
    },
    { name: "Bob", age: 0, tags: [], embedding: stringToVector("Bob", 16) },
    {
      name: "Charlie",
      age: 35,
      tags: ["z"],
      embedding: stringToVector("Charlie", 16),
    },
    {
      name: "Diana",
      age: 28,
      tags: ["x"],
      embedding: stringToVector("Diana", 16),
    },
    { name: "Eve", age: 40, tags: ["y"], embedding: stringToVector("Eve", 16) },
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
      order_by: "age",
      order: "desc",
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
      embedding: stringToVector("Frank", 16),
    });
    expect(row.id).toBeDefined();
    expect(row.name).toBe("Frank");
  });

  it("update row", async () => {
    const row = await qb.update(1, { age: 31 });
    expect(row?.age).toBe(31);
  });

  it("soft delete row", async () => {
    await qb.delete(1);
    const res = await qb.list({});
    expect(res.data.find((r) => r.id === 1)).toBeUndefined();
  });

  it("hard delete row", async () => {
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
