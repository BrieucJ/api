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
 * Sign a JWT token with user information
 */
export async function signToken(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<string> {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;

  // Parse expiresIn (e.g., "24h", "7d", "30m")
  let expiresInSeconds: number;
  if (expiresIn.endsWith("h")) {
    expiresInSeconds = parseInt(expiresIn.slice(0, -1)) * 3600;
  } else if (expiresIn.endsWith("d")) {
    expiresInSeconds = parseInt(expiresIn.slice(0, -1)) * 86400;
  } else if (expiresIn.endsWith("m")) {
    expiresInSeconds = parseInt(expiresIn.slice(0, -1)) * 60;
  } else {
    // Default to 24 hours if format is unknown
    expiresInSeconds = 24 * 3600;
  }

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
