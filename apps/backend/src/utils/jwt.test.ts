import { describe, it, expect } from "bun:test";
import { signToken, verifyToken } from "@/utils/jwt";
import env from "@/env";

describe("JWT Utilities", () => {
  it("should sign and verify token", async () => {
    const payload = {
      userId: 1,
      email: "test@example.com",
      role: "admin",
    };

    const token = await signToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const verified = await verifyToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
  });

  it("should include expiration in token", async () => {
    const payload = {
      userId: 1,
      email: "test@example.com",
      role: "admin",
    };

    const token = await signToken(payload);
    const verified = await verifyToken(token);

    expect(verified.exp).toBeDefined();
    expect(verified.iat).toBeDefined();
    expect(verified.exp).toBeGreaterThan(verified.iat as number);
  });

  it("should reject invalid token", async () => {
    const invalidToken = "invalid.token.here";

    try {
      await verifyToken(invalidToken);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
