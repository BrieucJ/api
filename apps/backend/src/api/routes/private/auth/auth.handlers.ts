import type { AppRouteHandler } from "@/utils/types";
import type { LoginRoute, MeRoute, LogoutRoute, RefreshRoute } from "./auth.routes";
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

const userQuery = createQueryBuilder<typeof usersTable>(usersTable);

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deleted_at)))
    .limit(1);

  if (!user) {
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
  if (!user.password_hash) {
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
  const isValidPassword = await verifyPassword(password, user.password_hash);

  if (!isValidPassword) {
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

  // Store refresh token in database
  await db.insert(refreshTokensTable).values({
    token_hash: refreshTokenHash,
    user_id: user.id,
    expires_at: expiresAt,
    device_info: c.req.header("user-agent") || null,
    ip_address:
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip") ||
      null,
  });

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
  // Fetch all non-revoked, non-expired tokens
  const activeTokens = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        isNull(refreshTokensTable.revoked_at),
        isNull(refreshTokensTable.deleted_at)
      )
    );

  // Find matching token by verifying against stored hashes
  let storedToken = null;
  for (const token of activeTokens) {
    // Check if expired first (skip expired tokens)
    if (isRefreshTokenExpired(token.expires_at)) {
      // Clean up expired token
      await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.id, token.id));
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
    const activeTokens = await db
      .select()
      .from(refreshTokensTable)
      .where(
        and(
          isNull(refreshTokensTable.revoked_at),
          isNull(refreshTokensTable.deleted_at)
        )
      );

    for (const token of activeTokens) {
      const isValid = await verifyRefreshToken(refreshToken, token.token_hash);
      if (isValid) {
        await db
          .update(refreshTokensTable)
          .set({ revoked_at: new Date() })
          .where(eq(refreshTokensTable.id, token.id));
        break;
      }
    }
  }

  // Optional: Revoke all refresh tokens for this user
  // const user = c.get("user");
  // if (user) {
  //   await db
  //     .update(refreshTokensTable)
  //     .set({ revoked_at: new Date() })
  //     .where(
  //       and(
  //         eq(refreshTokensTable.user_id, user.userId),
  //         isNull(refreshTokensTable.revoked_at)
  //       )
  //     );
  // }

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
