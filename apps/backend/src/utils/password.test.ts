import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword } from "@/utils/password";

describe("Password Utilities", () => {
  it("should hash password", async () => {
    const hash = await hashPassword("testpassword123");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("testpassword123");
    expect(hash.length).toBeGreaterThan(20);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("should verify correct password", async () => {
    const hash = await hashPassword("testpassword123");
    const isValid = await verifyPassword("testpassword123", hash);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const hash = await hashPassword("testpassword123");
    const isValid = await verifyPassword("wrongpassword", hash);
    expect(isValid).toBe(false);
  });

  it("should produce different hashes for same password", async () => {
    const hash1 = await hashPassword("testpassword123");
    const hash2 = await hashPassword("testpassword123");
    expect(hash1).not.toBe(hash2); // Different salts
  });

  it("should reject invalid hash format", async () => {
    const isValid = await verifyPassword("password", "invalid-hash-format");
    expect(isValid).toBe(false);
  });
});
