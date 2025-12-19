import type { Table } from "drizzle-orm/table";

/**
 * Improved string-to-vector encoding that captures more meaningful features.
 * Uses word-based hashing and character n-grams for better discrimination.
 */
export const stringToVector = (str: string, dim = 16): number[] => {
  if (!str || str.length === 0) {
    return new Array(dim).fill(0);
  }

  const vec = new Array(dim).fill(0);
  const normalized = str.toLowerCase().trim();

  // 1. Word-based features (better semantic discrimination)
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  for (const word of words) {
    // Hash word to dimension index
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    // Weight by word length (longer words are more distinctive)
    vec[idx] += word.length / (words.length || 1);
  }

  // 2. Character bigram features (captures character patterns)
  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.slice(i, i + 2);
    let hash = 0;
    for (let j = 0; j < bigram.length; j++) {
      hash = ((hash << 5) - hash + bigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 0.5 / (normalized.length - 1 || 1);
  }

  // 3. Character frequency (original approach, but weighted less)
  for (let i = 0; i < normalized.length; i++) {
    const idx = normalized.charCodeAt(i) % dim;
    vec[idx] += 0.3 / normalized.length;
  }

  // Normalize to unit vector (L2 normalization for cosine similarity)
  const magnitude = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  if (magnitude > 0) {
    return vec.map((x) => x / magnitude);
  }

  return vec;
};

export function generateRowEmbedding<T extends Table>(
  data: Partial<T["$inferInsert"]>
): number[] {
  // Prioritize message field (most important for search)
  // Then include other fields with lower weight
  const parts: string[] = [];

  // Message is most important
  if (data.message) {
    parts.push(String(data.message));
  }

  // Source and level are secondary
  if (data.source) {
    parts.push(String(data.source));
  }
  if (data.level) {
    parts.push(String(data.level));
  }

  // Meta fields are least important
  if (data.meta && typeof data.meta === "object") {
    const metaStr = JSON.stringify(data.meta);
    // Only include first part of meta to avoid overwhelming the vector
    parts.push(metaStr.slice(0, 200));
  }

  const combined = parts.join(" | ");
  return stringToVector(combined, 16);
}
