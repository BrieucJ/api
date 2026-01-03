import { testClient } from "hono/testing";
import app from "@/api/index";
import env from "@/env";
import { sign } from "hono/jwt";
import { users } from "@/db/models/users";
import { createQueryBuilder } from "@/db/querybuilder";
import { hashPassword } from "@/utils/password";
import { runInTransaction } from "./db-setup";

/**
 * Create test client from the Hono app
 * This provides type-safe testing with real HTTP requests
 */
export const client = testClient(app) as any;

/**
 * Create a test user and return JWT token
 */
export async function createTestUser(
  email: string = "test@example.com",
  password: string = "password123",
  role: "admin" | "user" = "admin"
): Promise<{ user: any; token: string }> {
  const userQuery = createQueryBuilder<typeof users>(users);
  const password_hash = await hashPassword(password);

  // Check if user already exists
  const existing = await userQuery.list({
    filters: { email__eq: email },
    limit: 1,
  });

  let user;
  if (existing.data.length > 0) {
    user = existing.data[0];
  } else {
    user = await userQuery.create({
      email,
      password_hash,
      role,
    });
  }

  if (!user) {
    throw new Error("Failed to create test user");
  }

  // Generate JWT token
  const token = await sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    "HS256"
  );

  return { user, token };
}

/**
 * Create a minimal mock context for middleware testing
 * Only use this for testing middleware in isolation
 */
export function createMockContextForMiddleware(
  method: string = "GET",
  path: string = "/",
  headers?: Record<string, string>
): any {
  const url = new URL(`http://localhost${path}`);
  const allHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };
  const req = new Request(url.toString(), {
    method,
    headers: allHeaders,
  });

  const responseHeaders = new Headers();
  let responseStatus = 200;

  const context = {
    req: {
      method,
      url: url.toString(),
      path: url.pathname,
      header: (name?: string) => {
        if (name) return headers?.[name] || req.headers.get(name) || undefined;
        return Object.fromEntries(req.headers.entries());
      },
      headers: new Headers(headers),
      raw: req,
      query: () => {
        const query: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });
        return query;
      },
      param: () => ({}),
      json: async () => {
        try {
          return await req.json();
        } catch {
          return null;
        }
      },
      text: async () => {
        try {
          return await req.text();
        } catch {
          return "";
        }
      },
    },
    res: {
      status: 200,
      headers: responseHeaders,
      header: (name: string, value: string) => {
        responseHeaders.set(name, value);
      },
      clone: () => {
        return new Response(null, {
          status: responseStatus,
          headers: responseHeaders,
        });
      },
    },
    env,
    json: (data: any, status?: number) => {
      responseStatus = status || 200;
      return new Response(JSON.stringify(data), {
        status: responseStatus,
        headers: responseHeaders,
      });
    },
    body: (body: any, status?: number, headers?: Headers) => {
      responseStatus = status || 200;
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          responseHeaders.set(key, value as string);
        });
      }
      return new Response(body, {
        status: responseStatus,
        headers: responseHeaders,
      });
    },
    header: (name: string, value: string) => {
      responseHeaders.set(name, value);
    },
    newResponse: (body: any, init?: ResponseInit) => {
      return new Response(body, {
        status: init?.status || 200,
        headers: init?.headers || responseHeaders,
        ...init,
      });
    },
    set: (key: string, value: any) => {
      (context as any)[key] = value;
    },
    get: (key: string) => {
      return (context as any)[key];
    },
    finalized: false,
  } as any;

  // Make res.status writable
  Object.defineProperty(context.res, "status", {
    get: () => responseStatus,
    set: (value: number) => {
      responseStatus = value;
    },
    enumerable: true,
    configurable: true,
  });

  return context;
}

/**
 * Create authenticated context for middleware testing
 */
export async function createAuthenticatedContextForMiddleware(
  method: string = "GET",
  path: string = "/",
  role: "admin" | "user" = "admin"
): Promise<any> {
  const { token } = await createTestUser(
    "test@example.com",
    "password123",
    role
  );
  return createMockContextForMiddleware(method, path, {
    Authorization: `Bearer ${token}`,
  });
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a test with automatic transaction rollback
 * This ensures perfect isolation - each test gets a clean database state
 */
export function withTransaction<T>(testFn: () => Promise<T>): () => Promise<T> {
  return () => runInTransaction(testFn);
}
