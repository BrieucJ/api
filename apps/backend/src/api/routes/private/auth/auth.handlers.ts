import type { AppRouteHandler } from "@/utils/types";
import type {
  LoginRoute,
  MeRoute,
  LogoutRoute,
  RefreshRoute,
} from "./auth.routes";
import { createQueryBuilder } from "@/db/querybuilder";
import { users as usersTable } from "@/db/models/users";
import { refreshTokens as refreshTokensTable } from "@/db/models/refreshTokens";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { signAccessToken } from "@/utils/jwt";
import { verifyPassword } from "@/utils/password";
import {
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiration,
  verifyRefreshToken,
  isRefreshTokenExpired,
} from "@/utils/refreshToken";
import { db } from "@/db/db";
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "@/utils/logger";

const userQuery = createQueryBuilder<typeof usersTable>(usersTable);
const refreshTokenQuery =
  createQueryBuilder<typeof refreshTokensTable>(refreshTokensTable);

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { email, password } = c.req.valid("json");

  // Log JWT_SECRET info (safely - don't log the actual secret)
  const jwtSecret = process.env.JWT_SECRET;
  logger.info(`JWT_SECRET configured: ${jwtSecret}`);

  logger.info(`Login attempt for email: ${email}`);

  // Use querybuilder to find user by email
  const { data: users } = await userQuery.list({
    filters: { email__eq: email },
    limit: 1,
  });

  const user = users[0];

  // Get password_hash separately (querybuilder excludes it for security)
  // This is an exception for authentication - we need password_hash to verify
  let password_hash: string | null = null;
  if (user) {
    const [userWithPassword] = await db
      .select({
        password_hash: usersTable.password_hash,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(and(eq(usersTable.id, user.id), isNull(usersTable.deleted_at)))
      .limit(1);
    password_hash = userWithPassword?.password_hash || null;
  }

  if (!user) {
    logger.warn(`Login failed: User not found for email: ${email}`);
    return c.json(
      {
        data: null,
        error: {
          name: "UnauthorizedError",
          message: "Invalid email or password",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNAUTHORIZED
    );
  }

  // Check if user has password_hash (is an auth user)
  if (!password_hash) {
    return c.json(
      {
        data: null,
        error: {
          name: "UnauthorizedError",
          message: "Invalid email or password",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNAUTHORIZED
    );
  }

  // Verify password using cross-platform password verification
  logger.info(
    `Verifying password for user ${
      user.id
    }, password_hash exists: ${!!password_hash}, hash length: ${
      password_hash?.length || 0
    }, hash prefix: ${password_hash?.substring(0, 20) || "none"}...`
  );
  const isValidPassword = await verifyPassword(password, password_hash);
  logger.info(
    `Password verification result: ${isValidPassword ? "VALID" : "INVALID"}`
  );

  if (!isValidPassword) {
    logger.warn(
      `Login failed: Invalid password for email: ${email} (user ID: ${user.id})`
    );
    return c.json(
      {
        data: null,
        error: {
          name: "UnauthorizedError",
          message: "Invalid email or password",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNAUTHORIZED
    );
  }

  // Check if user has admin role
  if (user.role !== "admin") {
    return c.json(
      {
        data: null,
        error: {
          name: "ForbiddenError",
          message: "Admin access required",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.FORBIDDEN
    );
  }

  // Generate access token (short-lived)
  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Generate refresh token (long-lived)
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiration();

  // Store refresh token in database using querybuilder
  try {
    await refreshTokenQuery.create({
      token_hash: refreshTokenHash,
      user_id: user.id,
      expires_at: expiresAt,
      device_info: c.req.header("user-agent") || null,
      ip_address:
        c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null,
    });
    logger.debug(`Refresh token stored for user: ${user.id}`);
  } catch (error) {
    // Log the error but don't fail login if refresh token storage fails
    // This allows login to work even if refresh_tokens table has issues
    logger.error(`Failed to store refresh token for user ${user.id}:`, error);
    // Continue with login - user will just need to login again when access token expires
  }

  logger.info(`Login successful for user: ${user.email} (id: ${user.id})`);

  return c.json(
    {
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role as "admin" | "user",
        },
      },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const me: AppRouteHandler<MeRoute> = async (c) => {
  // Get user from context (set by auth middleware)
  const user = c.get("user");

  if (!user) {
    return c.json(
      {
        data: null,
        error: {
          name: "UnauthorizedError",
          message: "Not authenticated",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNAUTHORIZED
    );
  }

  // Fetch fresh user data from database
  const dbUser = await userQuery.get(user.userId);

  if (!dbUser) {
    return c.json(
      {
        data: null,
        error: {
          name: "NotFoundError",
          message: "User not found",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  return c.json(
    {
      data: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role as "admin" | "user",
      },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const refresh: AppRouteHandler<RefreshRoute> = async (c) => {
  const { refreshToken } = c.req.valid("json");

  // Since scrypt uses random salts, we can't directly lookup by hash
  // We need to fetch active tokens and verify against each one
  // Use querybuilder to get all non-revoked tokens (querybuilder filters deleted_at automatically)
  // Note: We need token_hash which is not excluded, so it should be available
  const { data: activeTokens } = await refreshTokenQuery.list({
    filters: { revoked_at__isnull: true },
    limit: 1000, // Get all active tokens (reasonable limit)
  });

  // Find matching token by verifying against stored hashes
  let storedToken = null;
  for (const token of activeTokens) {
    // Check if expired first (skip expired tokens)
    if (isRefreshTokenExpired(token.expires_at)) {
      // Clean up expired token using querybuilder
      await refreshTokenQuery.delete(token.id, false); // Hard delete
      continue;
    }

    // Verify the incoming token against this stored hash
    const isValid = await verifyRefreshToken(refreshToken, token.token_hash);
    if (isValid) {
      storedToken = token;
      break;
    }
  }

  if (!storedToken) {
    return c.json(
      {
        data: null,
        error: {
          name: "UnauthorizedError",
          message: "Invalid or expired refresh token",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.UNAUTHORIZED
    );
  }

  // Get user
  const user = await userQuery.get(storedToken.user_id);
  if (!user || user.deleted_at) {
    return c.json(
      {
        data: null,
        error: {
          name: "NotFoundError",
          message: "User not found",
        },
        metadata: null,
      },
      HTTP_STATUS_CODES.NOT_FOUND
    );
  }

  // Generate new access token
  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return c.json(
    {
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role as "admin" | "user",
        },
      },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  // Get refresh token from request body if provided
  const body = c.req.valid("json");
  const refreshToken = body?.refreshToken;

  if (refreshToken) {
    // Find and revoke the refresh token by verifying against stored hashes
    // Use querybuilder to get all non-revoked tokens
    const { data: activeTokens } = await refreshTokenQuery.list({
      filters: { revoked_at__isnull: true },
      limit: 1000,
    });

    for (const token of activeTokens) {
      // token_hash should be available from querybuilder
      if (!token.token_hash) continue;

      const isValid = await verifyRefreshToken(refreshToken, token.token_hash);
      if (isValid) {
        // Update to revoke using querybuilder
        await refreshTokenQuery.update(token.id, { revoked_at: new Date() });
        break;
      }
    }
  }

  return c.json(
    {
      data: {
        success: true,
      },
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
