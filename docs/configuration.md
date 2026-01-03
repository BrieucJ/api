# Configuration

## Environment Variables

Environment variables are configured using `.env.dev` (or `.env` for legacy support) files in each app directory. The backend uses `.env.dev` for development, and the worker uses `.env.dev`, `.env.production`, or `.env.staging` based on `NODE_ENV`.

**Quick Setup:**
```bash
# Create environment files manually
# Backend: Create apps/backend/.env.dev
# Worker: Create apps/worker/.env.dev
# Client: Create apps/client/.env (optional)
```

**Required variables for each app:**
- See the sections below for complete lists
- All variables are documented with their types, defaults, and requirements

### Key Variables

**Backend** (`apps/backend/.env.dev`):
- `DATABASE_URL` (required) - PostgreSQL connection string
- `JWT_SECRET` (required) - Must be at least 32 characters (generate with `openssl rand -base64 32`)
- `LOG_LEVEL` (required) - Log level: fatal, error, warn, info, debug, trace, silent
- `REGION`, `SQS_QUEUE_URL` (required in production/staging)

**Worker** (`apps/worker/.env.dev`):
- `DATABASE_URL` (required) - PostgreSQL connection string
- `WORKER_MODE` - `local` or `lambda` (default: `local`)
- `LOG_LEVEL` (required) - Log level
- `REGION`, `SQS_QUEUE_URL`, `LAMBDA_ARN` (required in production/staging/lambda mode)

**Client** (`apps/client/.env`):
- `VITE_BACKEND_URL` (optional) - Backend API URL (default: `http://localhost:8080`)
  - Note: The client default is incorrect - it defaults to port 8080, but the backend runs on port 3000 by default. You should set `VITE_BACKEND_URL=http://localhost:3000` to match the backend.

## Database Configuration

PostgreSQL connection string format:

```
postgresql://username:password@host:port/database
```

Required extensions:

- `vector` (for pgvector)

## Logging Configuration

Log levels (from most to least verbose):

- `trace`
- `debug`
- `info`
- `warn`
- `error`
- `fatal`
- `silent`

Set via `LOG_LEVEL` environment variable.

