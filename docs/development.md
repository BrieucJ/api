# Development

## Development Commands

### Backend (`apps/backend`)

```bash
bun run dev              # Start dev server with watch
bun run test            # Run tests
bun run db:migrate      # Run migrations
bun run db:push         # Push schema changes
bun run db:generate     # Generate migration files
bun run db:studio       # Open Drizzle Studio
bun run db:seed         # Seed database
```

### Client (`apps/client`)

```bash
bun run dev             # Start Vite dev server
bun run build           # Build for production
bun run preview         # Preview production build
bun run lint            # Run ESLint
```

### Worker (`apps/worker`)

```bash
bun run dev             # Start worker with watch
bun run test            # Run tests
```

## Code Structure

### Backend API Routes

Routes are organized by visibility:

- **Public Routes** (`/api/v1/*`): User-facing endpoints

  - `GET /api/v1/users` - List users
  - `GET /api/v1/users/:id` - Get user
  - `POST /api/v1/users` - Create user
  - `PATCH /api/v1/users/:id` - Update user
  - `DELETE /api/v1/users/:id` - Delete user

- **Private Routes** (`/*`): Internal/admin endpoints
  - `GET /logs` - List logs
  - `GET /metrics` - List metrics
  - `GET /metrics/aggregate` - Aggregate metrics
  - `GET /replay` - List request snapshots
  - `GET /replay/:id` - Get snapshot
  - `POST /replay/:id/replay` - Replay request
  - `GET /health` - Health check
  - `GET /info` - Server info
  - `GET /worker/jobs` - List jobs

### QueryBuilder Pattern

All database operations use the QueryBuilder:

```typescript
import { createQueryBuilder } from "@/db/querybuilder";
import { logs } from "@/db/models/logs";

const logQuery = createQueryBuilder<typeof logs>(logs);

// List with filters
const { data, total } = await logQuery.list({
  filters: {
    level__eq: "error",
    source__in: "API,WORKER",
    created_at__gte: new Date("2024-01-01"),
  },
  search: "database connection",
  limit: 20,
  offset: 0,
  order_by: "created_at",
  order: "desc",
});

// Get by ID
const log = await logQuery.get(1);

// Create
const newLog = await logQuery.create({
  source: "API",
  level: "info",
  message: "Server started",
});

// Update
const updated = await logQuery.update(1, {
  level: "warn",
});

// Delete (soft delete by default)
await logQuery.delete(1);
```

### Filter Syntax

QueryBuilder supports double-underscore filter syntax:

- `field__eq` - Equals
- `field__ne` - Not equals
- `field__gt` - Greater than
- `field__gte` - Greater than or equal
- `field__lt` - Less than
- `field__lte` - Less than or equal
- `field__like` - Contains (case-sensitive)
- `field__ilike` - Contains (case-insensitive)
- `field__in` - In array (comma-separated)
- `field__isnull` - Is null
- `field__isnotnull` - Is not null
- `field__startswith` - Starts with
- `field__endswith` - Ends with

### Middleware

Middleware is applied in order:

1. **Geo Middleware**: Extracts geographic information
2. **Metrics Middleware**: Tracks request metrics
3. **Snapshot Middleware**: Captures request/response
4. **Error Middleware**: Handles errors

## Testing

```bash
# Backend tests
cd apps/backend
bun test

# Worker tests
cd apps/worker
bun test
```

## Adding New Routes

1. **Create route definition** (`*.routes.ts`):

   ```typescript
   export const list = createRoute({
     method: "get",
     path: "my-route",
     // ...
   });
   ```

2. **Create handler** (`*.handlers.ts`):

   ```typescript
   export const list: AppRouteHandler<ListRoute> = async (c) => {
     // Handler logic
   };
   ```

3. **Register route** (`*.index.ts`):

   ```typescript
   const route = createRouter().openapi(list, listHandler);
   ```

4. **Add to main app** (`apps/backend/src/api/index.ts`)

