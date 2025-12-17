import type { Table } from "drizzle-orm/table";

export const stringToVector = (str: string, dim = 16): number[] => {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < str.length; i++) {
    vec[str.charCodeAt(i) % dim] += 1;
  }
  return vec.map((x) => x / str.length);
};

export function generateRowEmbedding<T extends Table>(
  data: Partial<T["$inferInsert"]>
): number[] {
  // Convert all values to strings and concatenate
  const combined = Object.values(data)
    .map((v) => (v === null || v === undefined ? "" : String(v)))
    .join(" | "); // separator between fields

  return stringToVector(combined, 16); // same dimension as before
}
