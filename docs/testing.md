# Testing Guide

## Overview

This project uses a comprehensive testing suite with:
- **Backend**: Bun's built-in test framework with transaction-based isolation
- **Frontend**: Vitest with React Testing Library
- **Test Database**: Separate PostgreSQL database for isolated testing
- **Coverage**: Automatic coverage reporting for both backend and frontend

## Test Database Setup

### Initial Setup

1. **Create `.env.test` file** in `apps/backend/`:
```env
NODE_ENV=test
PORT=3001
LOG_LEVEL=silent
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/api_test
JWT_SECRET=test-jwt-secret-key-minimum-32-characters-long-for-testing
JWT_EXPIRES_IN=24h
```

2. **Ensure PostgreSQL is running** with pgvector extension installed

3. **Setup test database** (creates database and runs migrations):
```bash
bun run test:db:setup
```

The test database will be automatically created and migrated when you first run tests, but you can also set it up manually using the command above.

### Database Management Commands

```bash
# Setup test database (create + migrate)
bun run test:db:setup

# Reset test database (truncate all tables)
bun run test:db:reset

# Drop test database completely
bun run test:db:drop
```

## Running Tests

### Backend Tests

```bash
# Run all backend tests
bun run test:backend

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run specific test suites
bun run test:routes          # Route handler tests
bun run test:middlewares      # Middleware tests
bun run test:utils            # Utility function tests
bun run test:db               # Database/querybuilder tests

# Run specific test file
bun test src/tests/routes/users/users.handlers.test.ts
```

### Frontend Tests

```bash
# Run all frontend tests
bun run test:client

# Run tests in watch mode
bun run test:client -- --watch

# Run tests with UI
bun run test:client -- --ui

# Run tests with coverage
bun run test:client -- --coverage
```

### All Tests

```bash
# Run both backend and frontend tests
bun run test

# Run all tests with coverage
bun run test:coverage
```

## Test Isolation

### Transaction-Based Isolation

Backend tests use **transaction rollback** for perfect isolation. Each test runs in a transaction that's automatically rolled back after completion, ensuring:

- No test affects another
- Each test starts with a clean database state
- Tests can run in parallel without conflicts

**Usage:**

```typescript
import { withTransaction } from "@/tests/helpers/test-helpers";

it(
  "should create a user",
  withTransaction(async () => {
    // Your test code here
    // All database changes will be rolled back automatically
  })
);
```

### Database Reset

For test suites that need a clean state, use `resetTestDatabase()` in `beforeEach`:

```typescript
import { resetTestDatabase } from "@/tests/helpers/db-setup";

beforeEach(async () => {
  await resetTestDatabase();
});
```

## Writing Tests

### Backend Route Tests

Example: Testing a user handler

```typescript
import { describe, it, expect } from "bun:test";
import * as handlers from "@/api/routes/public/users/users.handlers";
import { createMockContext, createTestUser, withTransaction } from "@/tests/helpers/test-helpers";

describe("Users Handlers", () => {
  it(
    "should create a user",
    withTransaction(async () => {
      const context = createMockContext("POST", "/api/v1/users", {
        email: "test@example.com",
        password: "password123",
      });
      context.req.valid = () => ({
        email: "test@example.com",
        password: "password123",
      });

      const response = await handlers.create(context);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.email).toBe("test@example.com");
    })
  );
});
```

### Backend Middleware Tests

Example: Testing auth middleware

```typescript
import { describe, it, expect } from "bun:test";
import auth from "@/api/middlewares/auth";
import { createAuthenticatedContext } from "@/tests/helpers/test-helpers";

describe("Auth Middleware", () => {
  it("should allow access with valid admin token", async () => {
    const context = createAuthenticatedContext("GET", "/logs", undefined, "admin");
    let nextCalled = false;
    const next = async () => { nextCalled = true; };

    await auth(context, next);

    expect(nextCalled).toBe(true);
    expect(context.get("user")).toBeDefined();
  });
});
```

### Frontend Component Tests

Example: Testing a React component

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("should render button with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

## Test Helpers

### Backend Helpers

Located in `apps/backend/src/tests/helpers/`:

- **`test-helpers.ts`**:
  - `createMockContext()` - Create Hono context for testing
  - `createTestUser()` - Create test user and return JWT token
  - `createAuthenticatedContext()` - Create context with valid JWT
  - `withTransaction()` - Wrap test in transaction for isolation

- **`db-setup.ts`**:
  - `setupTestDatabase()` - Create and migrate test database
  - `resetTestDatabase()` - Truncate all tables
  - `runInTransaction()` - Run code in transaction with rollback

### Frontend Helpers

Located in `apps/client/src/tests/setup.ts`:
- Automatically cleans up after each test
- Sets up `@testing-library/jest-dom` matchers

## Coverage Reports

### Backend Coverage

Coverage reports are generated in `apps/backend/coverage/`:
- **HTML**: `coverage/index.html` - Interactive HTML report
- **LCOV**: `coverage/lcov.info` - For CI/CD integration
- **Text**: Printed to console

### Frontend Coverage

Coverage reports are generated in `apps/client/coverage/`:
- **HTML**: `coverage/index.html` - Interactive HTML report
- **JSON**: `coverage/coverage-final.json` - Machine-readable format

### Viewing Coverage

```bash
# Backend
open apps/backend/coverage/index.html

# Frontend
open apps/client/coverage/index.html
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The GitHub Actions workflow:
1. Sets up PostgreSQL with pgvector
2. Creates and migrates test database
3. Runs backend tests
4. Runs frontend tests
5. Generates coverage reports
6. Uploads coverage as artifacts

## Best Practices

1. **Use transaction isolation** for backend tests to ensure clean state
2. **Reset database** in `beforeEach` for test suites that need fresh data
3. **Mock external dependencies** (APIs, services) in tests
4. **Test edge cases** and error conditions, not just happy paths
5. **Keep tests focused** - one assertion per test when possible
6. **Use descriptive test names** that explain what is being tested
7. **Clean up test data** - use transaction rollback or explicit cleanup

## Troubleshooting

### Test Database Connection Issues

If tests fail with database connection errors:

1. Ensure PostgreSQL is running: `pg_isready`
2. Check `.env.test` has correct `DATABASE_URL`
3. Verify database exists: `bun run test:db:setup`

### Migration Issues

If migrations fail:

1. Ensure test database is clean: `bun run test:db:drop && bun run test:db:setup`
2. Check migration files are up to date: `bun run db:generate`

### Transaction Issues

If tests interfere with each other:

1. Ensure you're using `withTransaction()` wrapper
2. Check that `resetTestDatabase()` is called in `beforeEach` if needed
3. Verify no tests are committing transactions manually

## Test Structure

```
apps/backend/src/tests/
├── helpers/
│   ├── db-setup.ts          # Database management
│   ├── db-helpers.ts        # Database utilities
│   └── test-helpers.ts      # Test utilities
├── routes/
│   ├── users/
│   │   └── users.handlers.test.ts
│   └── auth/
│       └── auth.handlers.test.ts
├── middlewares/
│   └── auth.test.ts
├── utils/
│   ├── password.test.ts
│   └── jwt.test.ts
└── setup.ts                 # Global test setup

apps/client/src/tests/
├── components/
│   ├── ProtectedRoute.test.tsx
│   └── ui/
│       └── button.test.tsx
└── setup.ts                 # Frontend test setup
```

