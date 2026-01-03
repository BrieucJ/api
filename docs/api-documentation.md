# API Documentation

## Base URLs

- **Development**: `http://localhost:3000`
- **Production**: Configured per deployment

## Authentication

The API uses JWT-based authentication. See [Authentication Routes](../apps/backend/src/api/routes/private/auth/) for login endpoints.

Protected routes require an `Authorization` header with a Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this structure:

```typescript
{
  data: T | null,           // Response data
  error: {                 // Error object (null on success)
    message: string
  } | null,
  metadata: {              // Pagination metadata (if applicable)
    limit: number,
    offset: number,
    total: number
  } | null
}
```

## Public Endpoints

### Users

- `GET /api/v1/users` - List users
  - Query params: `limit`, `offset`, `order_by`, `order`, `search`, filters
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create user
  - Body: `{ email: string, password: string }` (password must be at least 8 characters)
- `PATCH /api/v1/users/:id` - Update user
  - Body: `{ email?: string, password?: string }` (password must be at least 8 characters if provided)
- `DELETE /api/v1/users/:id` - Delete user (soft delete)

### Auth

- `POST /auth/login` - Login (public endpoint, no auth required)
  - Body: `{ email: string, password: string }`
  - Returns: `{ token: string, user: { id, email, role } }`
- `GET /auth/me` - Get current user (requires admin auth)
- `POST /auth/logout` - Logout (requires admin auth, client-side token removal)

## Private Endpoints

### Logs

- `GET /logs` - List logs
  - Query params: `limit`, `offset`, `order_by`, `order`, `search`, filters
  - Filters: `source__eq`, `level__eq`, `created_at__gte`, `id__gt` (for incremental fetching), etc.

### Metrics

- `GET /metrics` - List metrics
  - Query params: `limit`, `offset`, `order_by`, `order`, `endpoint`, `startDate`, `endDate`, `id__gt` (for incremental fetching)
- `GET /metrics/aggregate` - Aggregate metrics
  - Query params: `endpoint`, `startDate`, `endDate`, `windowSize`

### Replay

- `GET /replay` - List request snapshots
  - Query params: `limit`, `offset`, `order_by`, `order`, `method`, `path`, `statusCode`, `startDate`, `endDate`
- `GET /replay/:id` - Get snapshot by ID
- `POST /replay/:id/replay` - Replay a captured request

### Health & Info

- `GET /health` - Health check endpoint
- `GET /info` - Server information
- `GET /doc` - OpenAPI JSON schema
- `GET /reference` - Interactive API documentation (Scalar UI)

## OpenAPI Documentation

Interactive API documentation is available at `/reference` when the server is running. It provides:

- Complete API reference
- Request/response schemas
- Interactive endpoint testing
- Code examples

