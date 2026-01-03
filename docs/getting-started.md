# Getting Started

## Prerequisites

- **Bun**: Install from [bun.sh](https://bun.sh)
- **PostgreSQL**: Version 14+ with `pgvector` extension
- **Terraform**: 1.0+ (for infrastructure deployment)
- **AWS CLI**: For deployment (optional)
- **Docker**: For building container images

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd api
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   Create environment configuration files:

   ```bash
   # Backend - create .env.dev file
   # Create apps/backend/.env.dev with required variables
   
   # Worker - create .env.dev file  
   # Create apps/worker/.env.dev with required variables
   
   # Client (optional) - create .env file
   # Create apps/client/.env with optional variables
   ```

   Then edit each file and fill in the required values:
   - **Backend**: Set `DATABASE_URL`, `JWT_SECRET` (generate with `openssl rand -base64 32`), `LOG_LEVEL`, and other required variables
   - **Worker**: Set `DATABASE_URL`, `LOG_LEVEL`, and other required variables
   - **Client**: Set `VITE_BACKEND_URL` if different from default (`http://localhost:8080`)

   See [Configuration](./configuration.md) for detailed documentation of each variable.

4. **Set up PostgreSQL**

   ```bash
   # Create database
   createdb api_db

   # Enable pgvector extension
   psql api_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

5. **Run database migrations**

   ```bash
   cd apps/backend
   bun run db:migrate
   ```

6. **Seed the database (optional)**

   ```bash
   bun run db:seed
   ```

## Running Locally

**Start all services:**

```bash
# From root directory
bun run dev
```

This starts:

- Backend API on `http://localhost:3000` (default port, configurable via `PORT` env var)
- Worker on `http://localhost:8081` (default port, configurable via `PORT` env var)
- Client on `http://localhost:5173` (when started separately)

**Start services individually:**

```bash
# Backend only
bun run dev:backend

# Worker only
bun run dev:worker

# Client only (from apps/client)
cd apps/client
bun run dev
```

## Next Steps

- Read the [Architecture](./architecture.md) documentation to understand the system design
- Check out [Development](./development.md) for development workflows
- See [API Documentation](./api-documentation.md) for API endpoints
- Review [Configuration](./configuration.md) for environment variables and settings

