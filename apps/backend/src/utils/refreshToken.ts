import { randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "./password";
import env from "@/env";

// Refresh token expires in 7 days (configurable via env)
const REFRESH_TOKEN_EXPIRES_IN_DAYS =
  env.JWT_REFRESH_EXPIRES_IN_DAYS || 7;

/**
 * Generate a secure random refresh token
 * @returns 64-character hex string (32 bytes)
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a refresh token for storage (using same scrypt as passwords)
 * @param token - Plain text refresh token
 * @returns Hashed token in format: "scrypt$salt$hash"
 */
export async function hashRefreshToken(token: string): Promise<string> {
  // Reuse password hashing for consistency and security
  return hashPassword(token);
}

/**
 * Verify a refresh token against stored hash
 * @param token - Plain text refresh token
 * @param hash - Hashed token in format "scrypt$salt$hash"
 * @returns true if token matches, false otherwise
 */
export async function verifyRefreshToken(
  token: string,
  hash: string
): Promise<boolean> {
  return verifyPassword(token, hash);
}

/**
 * Calculate refresh token expiration date
 * @returns Date object representing expiration time
 */
export function getRefreshTokenExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiresAt;
}

/**
 * Check if refresh token is expired
 * @param expiresAt - Expiration date to check
 * @returns true if token is expired, false otherwise
 */
export function isRefreshTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

