/**
 * Password hashing utility using Node.js native crypto (scrypt)
 * Works in both Bun and Node.js/Lambda environments
 */

import { promisify } from "util";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";

// Promisify scrypt for async/await
const scryptAsync = promisify(scrypt);

// Scrypt parameters (N=16384, r=8, p=1 is a good default)
const SCRYPT_KEYLEN = 64; // 512 bits

/**
 * Hash a password using Node.js native crypto (scrypt)
 * @param password - Plain text password
 * @returns Hashed password in format: "scrypt$salt$hash"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

/**
 * Verify a password against a scrypt hash
 * @param password - Plain text password
 * @param hash - Hashed password in format "scrypt$salt$hash"
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!hash.startsWith("scrypt$")) {
    return false;
  }

  const [, salt, storedHash] = hash.split("$");
  if (!salt || !storedHash) {
    return false;
  }

  const computedHash = (await scryptAsync(
    password,
    salt,
    SCRYPT_KEYLEN
  )) as Buffer;

  // Convert stored hash from hex to Buffer for timing-safe comparison
  const storedHashBuffer = Buffer.from(storedHash, "hex");

  // Use timing-safe comparison to prevent timing attacks
  if (computedHash.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedHash, storedHashBuffer);
}
