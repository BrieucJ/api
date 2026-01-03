# Database

## Schema Overview

The database uses PostgreSQL with the following main tables:

### Users (`users`)

- `id`: Primary key (auto-increment)
- `email`: Text (required, unique)
- `password_hash`: Text (required)
- `role`: Enum (admin, user) - defaults to "user"
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `deleted_at`: Timestamp (soft delete)
- `embedding`: Vector(16) (for search)

### Logs (`logs`)

- `id`: Primary key
- `source`: Text (e.g., "API", "DB", "WORKER")
- `level`: Text (debug, info, warn, error)
- `message`: Text
- `meta`: JSONB (structured context)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

### Metrics (`metrics`)

- `id`: Primary key
- `window_start`: Timestamp (60-second window start)
- `window_end`: Timestamp (60-second window end)
- `endpoint`: Text
- `p50_latency`: Integer (milliseconds)
- `p95_latency`: Integer (milliseconds)
- `p99_latency`: Integer (milliseconds)
- `error_rate`: Integer (0-1, decimal percentage)
- `traffic_count`: Integer
- `request_size`: BigInt (nullable)
- `response_size`: BigInt (nullable)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

### Request Snapshots (`request_snapshots`)

- `id`: Primary key
- `method`: Text (GET, POST, etc.)
- `path`: Text
- `query`: JSONB
- `body`: JSONB
- `headers`: JSONB
- `user_id`: Text (nullable)
- `timestamp`: Timestamp
- `version`: Text
- `stage`: Text
- `status_code`: Integer (nullable)
- `response_body`: JSONB
- `response_headers`: JSONB
- `duration`: Integer (milliseconds)
- `geo_country`, `geo_region`, `geo_city`: Text (nullable)
- `geo_lat`, `geo_lon`: Double precision (nullable)
- `geo_source`: Text (platform, header, ip, none)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

## Soft Deletes

All tables support soft deletes via the `deleted_at` column. The QueryBuilder automatically filters out soft-deleted records:

```typescript
// Only returns non-deleted records
const logs = await logQuery.list({});

// Hard delete (if needed)
await logQuery.delete(id, false);
```

## Vector Embeddings

Vector embeddings are automatically generated for searchable records:

- **Dimensions**: 16
- **Encoding**: Word-based hashing + character n-grams
- **Fields**: Message, source, level (for logs)
- **Search**: Hybrid keyword + vector search

The QueryBuilder's `list()` method supports semantic search:

```typescript
const { data } = await logQuery.list({
  search: "database connection error", // Semantic search
});
```

## Migrations

Migrations are managed with Drizzle Kit:

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (development only)
bun run db:push
```

Migration files are in `apps/backend/src/migrations/`.

## Database Changes

1. **Update schema** in `apps/backend/src/db/models/`
2. **Generate migration**:
   ```bash
   bun run db:generate
   ```
3. **Review migration** in `apps/backend/src/migrations/`
4. **Apply migration**:
   ```bash
   bun run db:migrate
   ```

