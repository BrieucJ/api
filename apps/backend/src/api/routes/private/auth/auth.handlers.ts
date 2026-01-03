import type { AppRouteHandler } from "@/utils/types";
import type { LoginRoute, MeRoute, LogoutRoute } from "./auth.routes";
import { createQueryBuilder } from "@/db/querybuilder";
import { users as usersTable } from "@/db/models/users";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { signToken } from "@/utils/jwt";
import { verifyPassword } from "@/utils/password";
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

  // Generate JWT token
  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return c.json(
    {
      data: {
        token,
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

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  // Logout is handled client-side (token removal)
  // This endpoint just confirms the request
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
