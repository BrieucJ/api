import { sign, verify } from "hono/jwt";
import env from "@/env";

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

/**
 * Parse expiration string to seconds
 * @param expiresIn - Expiration string (e.g., "24h", "7d", "30m", "15m")
 * @returns Expiration in seconds
 */
function parseExpiresIn(expiresIn: string): number {
  if (expiresIn.endsWith("h")) {
    return parseInt(expiresIn.slice(0, -1)) * 3600;
  } else if (expiresIn.endsWith("d")) {
    return parseInt(expiresIn.slice(0, -1)) * 86400;
  } else if (expiresIn.endsWith("m")) {
    return parseInt(expiresIn.slice(0, -1)) * 60;
  } else {
    // Default to 15 minutes if format is unknown
    return 15 * 60;
  }
}

/**
 * Sign an access token with user information (short-lived)
 */
export async function signAccessToken(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<string> {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN;
  const expiresInSeconds = parseExpiresIn(expiresIn);

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const iat = Math.floor(Date.now() / 1000);

  return await sign(
    {
      ...payload,
      exp,
      iat,
    },
    secret
  );
}

/**
 * Sign a JWT token with user information (legacy, uses JWT_EXPIRES_IN)
 * @deprecated Use signAccessToken instead. Kept for backward compatibility.
 */
export async function signToken(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<string> {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;
  const expiresInSeconds = parseExpiresIn(expiresIn);

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const iat = Math.floor(Date.now() / 1000);

  return await sign(
    {
      ...payload,
      exp,
      iat,
    },
    secret
  );
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string
): Promise<Record<string, unknown>> {
  const secret = env.JWT_SECRET;
  const payload = await verify(token, secret);
  return payload;
}
