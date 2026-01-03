import { createRoute, z } from "@hono/zod-openapi";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import { responseSchema, createErrorSchema } from "@/utils/helpers";
import { userAuthSchema } from "@/db/models/users";

const tags = ["Auth"];

// Login request schema
const loginRequestSchema = z.object({
  email: z.email().openapi({ example: "admin@example.com" }),
  password: z.string().min(1).openapi({ example: "password123" }),
});

// Login response schema
const loginResponseSchema = z.object({
  accessToken: z
    .string()
    .openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
  refreshToken: z
    .string()
    .openapi({ example: "a1b2c3d4e5f6..." }),
  user: userAuthSchema,
});

// POST /auth/login - Public (no auth required)
export const login = createRoute({
  tags,
  method: "post",
  path: "auth/login",
  hide: true, // Not in OpenAPI
  summary: "Login",
  description: "Authenticate admin user and receive JWT token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginRequestSchema,
        },
      },
    },
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Login successful",
      loginResponseSchema
    ),
    [HTTP_STATUS_CODES.UNAUTHORIZED]: responseSchema(
      "Invalid credentials",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.FORBIDDEN]: responseSchema(
      "Admin access required",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: responseSchema(
      "Validation error",
      null,
      createErrorSchema(loginRequestSchema),
      null
    ),
  },
});

// GET /auth/me - Private (requires admin auth)
export const me = createRoute({
  tags,
  method: "get",
  path: "auth/me",
  hide: true, // Not in OpenAPI
  summary: "Get current user",
  description: "Get current authenticated admin user information",
  request: {},
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Current user information",
      userAuthSchema
    ),
    [HTTP_STATUS_CODES.UNAUTHORIZED]: responseSchema(
      "Unauthorized",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.NOT_FOUND]: responseSchema(
      "User not found",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
  },
});

// Logout request schema
const logoutRequestSchema = z.object({
  refreshToken: z.string().optional().openapi({ example: "a1b2c3d4e5f6..." }),
});

// POST /auth/logout - Private (requires admin auth)
export const logout = createRoute({
  tags,
  method: "post",
  path: "auth/logout",
  hide: true, // Not in OpenAPI
  summary: "Logout",
  description: "Logout current user and revoke refresh token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: logoutRequestSchema,
        },
      },
    },
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Logout successful",
      z.object({ success: z.boolean() })
    ),
    [HTTP_STATUS_CODES.UNAUTHORIZED]: responseSchema(
      "Unauthorized",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
  },
});

// Refresh request schema
const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).openapi({ example: "a1b2c3d4e5f6..." }),
});

// Refresh response schema
const refreshResponseSchema = z.object({
  accessToken: z
    .string()
    .openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
  user: userAuthSchema,
});

// POST /auth/refresh - Public (no auth required, but needs refresh token)
export const refresh = createRoute({
  tags,
  method: "post",
  path: "auth/refresh",
  hide: true, // Not in OpenAPI
  summary: "Refresh access token",
  description: "Exchange refresh token for new access token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: refreshRequestSchema,
        },
      },
    },
  },
  responses: {
    [HTTP_STATUS_CODES.OK]: responseSchema(
      "Token refreshed successfully",
      refreshResponseSchema
    ),
    [HTTP_STATUS_CODES.UNAUTHORIZED]: responseSchema(
      "Invalid or expired refresh token",
      null,
      z.object({
        name: z.string(),
        message: z.string(),
      }),
      null
    ),
    [HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY]: responseSchema(
      "Validation error",
      null,
      createErrorSchema(refreshRequestSchema),
      null
    ),
  },
});

export type LoginRoute = typeof login;
export type MeRoute = typeof me;
export type LogoutRoute = typeof logout;
export type RefreshRoute = typeof refresh;
