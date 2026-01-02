import { createMiddleware } from "hono/factory";
import { jwt } from "hono/jwt";
import type { Context } from "hono";
import env from "@/env";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";

/**
 * Authentication Middleware
 *
 * Verifies JWT token from Authorization header and ensures user has admin role.
 * Sets user data in context: c.set('user', { userId, email, role })
 */
const authMiddleware = createMiddleware(async (c: Context, next) => {
  // Use Hono's built-in JWT middleware to verify token
  const jwtMiddleware = jwt({
    secret: env.JWT_SECRET,
  });

  // Apply JWT verification - jwt middleware will verify and set jwtPayload
  // If token is invalid, jwtMiddleware returns a 401 response
  // If token is valid, it calls the callback
  const result = await jwtMiddleware(c, async () => {
    // Get the JWT payload (set by hono/jwt middleware)
    // At this point, we know the token is valid
    const payload = c.get("jwtPayload") as {
      userId: number;
      email: string;
      role: string;
      exp: number;
      iat: number;
    };

    // Check if user has admin role
    if (payload.role !== "admin") {
      // Return error response - callback can return Response
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
      ) as any; // Type assertion needed because Next expects Promise<void>
    }

    // Set user data in context for use in handlers
    c.set("user", {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    await next();
  });

  // If JWT middleware or callback returned a response (error), return it
  if (result) {
    return result;
  }
});

export default authMiddleware;
