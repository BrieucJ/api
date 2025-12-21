# API Monitoring & Observability Platform

A comprehensive multi-platform API monitoring and observability system with real-time metrics, logs, request replay capabilities, and a modern dashboard. Built with Bun, Hono, React, and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Worker & Jobs](#worker--jobs)
- [Frontend](#frontend)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Contributing](#contributing)

## Overview

This platform provides comprehensive observability for APIs with:

- **Real-time Metrics**: Automatic collection and aggregation of API performance metrics (latency, error rates, traffic)
- **Log Streaming**: Server-Sent Events (SSE) for real-time log monitoring
- **Request Replay**: Capture and replay HTTP requests for debugging and testing
- **Vector Search**: Semantic search capabilities using PostgreSQL vector embeddings
- **Background Jobs**: Asynchronous job processing with SQS/local queue support
- **Modern Dashboard**: React-based UI with real-time updates and interactive charts

### Use Cases

- API performance monitoring and alerting
- Debugging production issues through request replay
- Real-time log analysis and filtering
- Metrics aggregation and visualization
- Geographic request tracking
- Historical data analysis

## Architecture

The system consists of three main applications working together:

```mermaid
graph TB
    subgraph Client["Frontend Client"]
        UI[React Dashboard]
        SSE1[SSE Connections]
    end

    subgraph Backend["Backend API"]
        API[Hono Server]
        Middleware[Middleware Stack]
        Handlers[Route Handlers]
        QueryBuilder[QueryBuilder]
    end

    subgraph Worker["Background Worker"]
        Queue[Job Queue]
        Scheduler[CRON Scheduler]
        JobHandlers[Job Handlers]
    end

    subgraph Database["PostgreSQL"]
        DB[(Database)]
        Vector[Vector Search]
    end

    subgraph Infrastructure["Infrastructure"]
        Lambda[AWS Lambda]
        SQS[AWS SQS]
        EventBridge[EventBridge]
    end

    UI -->|HTTP/SSE| API
    API -->|Query| QueryBuilder
    QueryBuilder -->|SQL| DB
    API -->|Enqueue Jobs| Queue
    Queue -->|Process| JobHandlers
    Scheduler -->|Schedule| Queue
    JobHandlers -->|Write| DB
    QueryBuilder -->|Vector Search| Vector
    Queue -.->|Production| SQS
    Scheduler -.->|Production| EventBridge
    API -.->|Production| Lambda
```

### Component Descriptions

#### Backend API (`apps/backend`)

- **Framework**: Hono (lightweight, fast web framework)
- **Runtime**: Bun (JavaScript runtime)
- **Database**: PostgreSQL with Drizzle ORM
- **Features**:
  - RESTful API with OpenAPI documentation
  - Middleware for metrics collection, request snapshotting, and geo-location
  - QueryBuilder for type-safe database operations
  - Vector embeddings for semantic search
  - Soft delete support

#### Frontend Client (`apps/client`)

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: Zustand
- **Features**:
  - Real-time dashboard with SSE connections
  - Interactive metrics charts
  - Log viewer with filtering
  - Request replay interface
  - Worker job management

#### Worker (`apps/worker`)

- **Purpose**: Background job processing
- **Queue System**: SQS (production) or Local (development)
- **Scheduler**: EventBridge (production) or node-cron (local)
- **Job Types**:
  - Metrics aggregation
  - Log cleanup
  - Health checks
- **Features**:
  - Retry logic with exponential backoff
  - Job registry system
  - CRON-based scheduling

#### Infrastructure (`infra`)

- **Tool**: Pulumi (Infrastructure as Code)
- **Platforms**: AWS Lambda, ECS, Cloudflare Workers
- **Services**: SQS, EventBridge, API Gateway

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Middleware
    participant Handler
    participant QueryBuilder
    participant DB
    participant Queue

    Client->>API: HTTP Request
    API->>Middleware: Geo Middleware
    Middleware->>Middleware: Extract Geo Info
    API->>Middleware: Metrics Middleware
    Middleware->>Middleware: Track Start Time
    API->>Middleware: Snapshot Middleware
    Middleware->>Middleware: Capture Request
    API->>Handler: Route Handler
    Handler->>QueryBuilder: Database Query
    QueryBuilder->>DB: SQL Query
    DB-->>QueryBuilder: Results
    QueryBuilder-->>Handler: Typed Results
    Handler->>Queue: Enqueue Job (async)
    Handler-->>API: Response
    API->>Middleware: Metrics Middleware
    Middleware->>Queue: Enqueue Raw Metrics
    API-->>Client: HTTP Response
    Middleware->>DB: Store Snapshot (async)
```

## Tech Stack

### Runtime

- **Bun**: Fast JavaScript runtime, bundler, and package manager

### Backend

- **Hono**: Ultra-fast web framework
- **Drizzle ORM**: TypeScript ORM with PostgreSQL
- **Zod**: Schema validation
- **@hono/zod-openapi**: OpenAPI integration
- **PostgreSQL**: Database with vector extension support

### Frontend

- **React 19**: UI library
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Charting library
- **Zustand**: State management
- **React Router**: Client-side routing
- **Radix UI**: Accessible component primitives

### Infrastructure

- **Pulumi**: Infrastructure as Code
- **AWS SDK**: AWS service integration
  - Lambda
  - SQS
  - EventBridge
  - API Gateway
  - ECR

### Development Tools

- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Drizzle Kit**: Database migrations

## Features

### Real-time Metrics Collection

Automatic collection of API performance metrics:

- **Latency Percentiles**: P50, P95, P99
- **Error Rates**: Percentage of failed requests
- **Traffic Counts**: Request volume per endpoint
- **Request/Response Sizes**: Bandwidth tracking
- **Time Windows**: 60-second aggregation windows

Metrics are collected via middleware and processed asynchronously by the worker.

### Log Streaming

Server-Sent Events (SSE) for real-time log monitoring:

- Stream logs as they're created
- Filter by source, level, or message
- Search with keyword and semantic search
- Real-time updates in the dashboard

### Request Snapshot & Replay

Capture and replay HTTP requests:

- **Automatic Capture**: All `/api/v1/*` requests are captured
- **Full Context**: Method, path, query, body, headers, response
- **Geo Information**: Country, region, city, coordinates
- **Replay**: Execute captured requests for debugging
- **Safety**: Blocks replay to sensitive endpoints

### Vector-based Semantic Search

PostgreSQL vector embeddings for semantic search:

- **Hybrid Search**: Combines keyword (ILIKE) and vector (cosine similarity)
- **Automatic Embeddings**: Generated on create/update
- **16-dimensional Vectors**: Lightweight but effective
- **Searchable Fields**: Message, source, level for logs

### Job Queue System

Asynchronous job processing:

- **SQS Integration**: Production-ready queue
- **Local Queue**: Development-friendly in-memory queue
- **Retry Logic**: Exponential backoff on failures
- **Job Types**: Metrics processing, log cleanup, health checks

### CRON Scheduling

Scheduled job execution:

- **EventBridge**: Production scheduling
- **node-cron**: Local development
- **Default Jobs**: Health checks, log cleanup, metrics aggregation

### Geo-location Tracking

Automatic geographic information extraction:

- **Multiple Sources**: Cloudflare, CloudFront, custom headers, IP lookup
- **Fallback Chain**: Platform → Headers → IP → None
- **Data Captured**: Country, region, city, coordinates

### OpenAPI Documentation

Interactive API documentation:

- **Scalar UI**: Beautiful API reference
- **Auto-generated**: From Zod schemas
- **Interactive**: Test endpoints directly
- **Available at**: `/reference`

## Project Structure

```
api/
├── apps/
│   ├── backend/              # Backend API application
│   │   ├── src/
│   │   │   ├── api/          # API routes and handlers
│   │   │   │   ├── routes/
│   │   │   │   │   ├── public/    # Public routes (/api/v1/*)
│   │   │   │   │   │   └── users/
│   │   │   │   │   └── private/   # Private routes (/*)
│   │   │   │   │       ├── logs/
│   │   │   │   │       ├── metrics/
│   │   │   │   │       ├── replay/
│   │   │   │   │       ├── health/
│   │   │   │   │       ├── info/
│   │   │   │   │       ├── error/
│   │   │   │   │       └── worker/
│   │   │   │   └── middlewares/   # Request middleware
│   │   │   │       ├── metrics.ts    # Metrics collection
│   │   │   │       ├── snapshot.ts   # Request snapshotting
│   │   │   │       ├── geo.ts        # Geo-location
│   │   │   │       └── ...
│   │   │   ├── db/           # Database layer
│   │   │   │   ├── models/   # Drizzle schema definitions
│   │   │   │   ├── querybuilder.ts  # Query builder
│   │   │   │   ├── db.ts     # Database connection
│   │   │   │   └── seed.ts   # Database seeding
│   │   │   ├── servers/      # Server implementations
│   │   │   │   ├── http.ts   # HTTP server (Bun)
│   │   │   │   ├── lambda.ts # AWS Lambda handler
│   │   │   │   └── cloudflareworker.ts # Cloudflare Worker
│   │   │   ├── utils/        # Utilities
│   │   │   │   ├── encode.ts      # Vector encoding
│   │   │   │   ├── queue.ts        # Job queue
│   │   │   │   ├── logger.ts       # Logging
│   │   │   │   └── ...
│   │   │   └── migrations/   # Database migrations
│   │   └── package.json
│   │
│   ├── client/               # Frontend React application
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   │   ├── ui/       # UI primitives (shadcn)
│   │   │   │   ├── LogsCard.tsx
│   │   │   │   ├── MetricsChart.tsx
│   │   │   │   └── ...
│   │   │   ├── pages/        # Page components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── LogsPage.tsx
│   │   │   │   ├── MetricsPage.tsx
│   │   │   │   ├── ReplayPage.tsx
│   │   │   │   └── WorkerPage.tsx
│   │   │   ├── store/        # Zustand store
│   │   │   ├── lib/          # Client utilities
│   │   │   └── hooks/        # React hooks
│   │   └── package.json
│   │
│   └── worker/               # Background worker
│       ├── src/
│       │   ├── jobs/         # Job handlers
│       │   │   ├── handlers/
│       │   │   │   ├── processRawMetrics.ts
│       │   │   │   ├── cleanupLogs.ts
│       │   │   │   └── ...
│       │   │   ├── registry.ts
│       │   │   └── types.ts
│       │   ├── queue/        # Queue implementations
│       │   │   ├── local.ts
│       │   │   └── sqs.ts
│       │   ├── scheduler/    # Scheduler implementations
│       │   │   ├── local.ts
│       │   │   └── eventbridge.ts
│       │   └── index.ts
│       └── package.json
│
├── infra/                    # Infrastructure as Code
│   ├── src/
│   │   ├── lambda.ts         # Lambda deployment
│   │   ├── ecs.ts            # ECS deployment
│   │   ├── worker.ts         # Worker deployment
│   │   └── client.ts         # Client deployment
│   └── Pulumi.yaml
│
├── packages/                 # Shared packages
│   └── src/
│       ├── db.ts            # Shared database types
│       ├── types.ts         # Shared TypeScript types
│       └── utils.ts         # Shared utilities
│
└── package.json             # Root workspace config
```

## Getting Started

### Prerequisites

- **Bun**: Install from [bun.sh](https://bun.sh)
- **PostgreSQL**: Version 14+ with `pgvector` extension
- **Node.js**: 18+ (for Pulumi, optional)
- **AWS CLI**: For deployment (optional)

### Installation

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

   Create `.env` files in each app directory:

   **`apps/backend/.env`**:

   ```env
   NODE_ENV=development
   PORT=3000
   LOG_LEVEL=info
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   WORKER_URL=http://localhost:8081
   ```

   **`apps/worker/.env`**:

   ```env
   NODE_ENV=development
   WORKER_MODE=local
   LOG_LEVEL=info
   PORT=8081
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ```

   **`apps/client/.env`** (optional):

   ```env
   VITE_API_URL=http://localhost:3000
   ```

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

### Running Locally

**Start all services:**

```bash
# From root directory
bun run dev
```

This starts:

- Backend API on `http://localhost:3000`
- Worker on `http://localhost:8081`

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

## Development

### Development Commands

**Backend (`apps/backend`):**

```bash
bun run dev              # Start dev server with watch
bun run test            # Run tests
bun run db:migrate      # Run migrations
bun run db:push         # Push schema changes
bun run db:generate     # Generate migration files
bun run db:studio       # Open Drizzle Studio
bun run db:seed         # Seed database
```

**Client (`apps/client`):**

```bash
bun run dev             # Start Vite dev server
bun run build           # Build for production
bun run preview         # Preview production build
bun run lint            # Run ESLint
```

**Worker (`apps/worker`):**

```bash
bun run dev             # Start worker with watch
bun run test            # Run tests
```

### Code Structure

#### Backend API Routes

Routes are organized by visibility:

- **Public Routes** (`/api/v1/*`): User-facing endpoints

  - `GET /api/v1/users` - List users
  - `GET /api/v1/users/:id` - Get user
  - `POST /api/v1/users` - Create user
  - `PATCH /api/v1/users/:id` - Update user
  - `DELETE /api/v1/users/:id` - Delete user

- **Private Routes** (`/*`): Internal/admin endpoints
  - `GET /logs` - List logs
  - `GET /logs/stream` - Stream logs (SSE)
  - `GET /metrics` - List metrics
  - `GET /metrics/stream` - Stream metrics (SSE)
  - `GET /metrics/aggregate` - Aggregate metrics
  - `GET /replay` - List request snapshots
  - `GET /replay/:id` - Get snapshot
  - `POST /replay/:id/replay` - Replay request
  - `GET /health` - Health check
  - `GET /info` - Server info
  - `GET /worker/jobs` - List jobs

#### QueryBuilder Pattern

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

#### Filter Syntax

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

#### Middleware

Middleware is applied in order:

1. **Geo Middleware**: Extracts geographic information
2. **Metrics Middleware**: Tracks request metrics
3. **Snapshot Middleware**: Captures request/response
4. **Error Middleware**: Handles errors

### Testing

```bash
# Backend tests
cd apps/backend
bun test

# Worker tests
cd apps/worker
bun test
```

## API Documentation

### Base URLs

- **Development**: `http://localhost:3000`
- **Production**: Configured per deployment

### Authentication

Currently, the API has no authentication. Add middleware as needed.

### Response Format

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

### Public Endpoints

#### Users

- `GET /api/v1/users` - List users
  - Query params: `limit`, `offset`, `order_by`, `order`, `search`, filters
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create user
  - Body: `{ name: string, age: number }`
- `PATCH /api/v1/users/:id` - Update user
  - Body: `{ name?: string, age?: number }`
- `DELETE /api/v1/users/:id` - Delete user (soft delete)

### Private Endpoints

#### Logs

- `GET /logs` - List logs
  - Query params: `limit`, `offset`, `order_by`, `order`, `search`, filters
  - Filters: `source__eq`, `level__eq`, `created_at__gte`, etc.
- `GET /logs/stream` - Stream logs via SSE
  - Returns: Server-Sent Events with `log-update` events

#### Metrics

- `GET /metrics` - List metrics
  - Query params: `limit`, `offset`, `order_by`, `order`, `endpoint`, `startDate`, `endDate`
- `GET /metrics/stream` - Stream metrics via SSE
  - Returns: Server-Sent Events with `metric-update` events
- `GET /metrics/aggregate` - Aggregate metrics
  - Query params: `endpoint`, `startDate`, `endDate`, `windowSize`

#### Replay

- `GET /replay` - List request snapshots
  - Query params: `limit`, `offset`, `order_by`, `order`, `method`, `path`, `statusCode`, `startDate`, `endDate`
- `GET /replay/:id` - Get snapshot by ID
- `POST /replay/:id/replay` - Replay a captured request

#### Health & Info

- `GET /health` - Health check endpoint
- `GET /info` - Server information
- `GET /doc` - OpenAPI JSON schema
- `GET /reference` - Interactive API documentation (Scalar UI)

### OpenAPI Documentation

Interactive API documentation is available at `/reference` when the server is running. It provides:

- Complete API reference
- Request/response schemas
- Interactive endpoint testing
- Code examples

## Database

### Schema Overview

The database uses PostgreSQL with the following main tables:

#### Users (`users`)

- `id`: Primary key (auto-increment)
- `name`: Text (required)
- `age`: Integer (required)
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `deleted_at`: Timestamp (soft delete)
- `embedding`: Vector(16) (for search)

#### Logs (`logs`)

- `id`: Primary key
- `source`: Text (e.g., "API", "DB", "WORKER")
- `level`: Text (debug, info, warn, error)
- `message`: Text
- `meta`: JSONB (structured context)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

#### Metrics (`metrics`)

- `id`: Primary key
- `windowStart`: Timestamp (60-second window start)
- `windowEnd`: Timestamp (60-second window end)
- `endpoint`: Text
- `p50Latency`: Integer (milliseconds)
- `p95Latency`: Integer (milliseconds)
- `p99Latency`: Integer (milliseconds)
- `errorRate`: Integer (0-100, percentage)
- `trafficCount`: Integer
- `requestSize`: BigInt (nullable)
- `responseSize`: BigInt (nullable)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

#### Request Snapshots (`request_snapshots`)

- `id`: Primary key
- `method`: Text (GET, POST, etc.)
- `path`: Text
- `query`: JSONB
- `body`: JSONB
- `headers`: JSONB
- `userId`: Text (nullable)
- `timestamp`: Timestamp
- `version`: Text
- `stage`: Text
- `statusCode`: Integer (nullable)
- `responseBody`: JSONB
- `responseHeaders`: JSONB
- `duration`: Integer (milliseconds)
- `geoCountry`, `geoRegion`, `geoCity`: Text (nullable)
- `geoLat`, `geoLon`: Double precision (nullable)
- `geoSource`: Text (platform, header, ip, none)
- `created_at`, `updated_at`, `deleted_at`, `embedding`

### Soft Deletes

All tables support soft deletes via the `deleted_at` column. The QueryBuilder automatically filters out soft-deleted records:

```typescript
// Only returns non-deleted records
const logs = await logQuery.list({});

// Hard delete (if needed)
await logQuery.delete(id, false);
```

### Vector Embeddings

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

### Migrations

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

## Worker & Jobs

### Job Types

The worker processes the following job types:

1. **PROCESS_RAW_METRICS**: Aggregates raw metrics into time windows

   - Groups metrics by 60-second windows
   - Calculates percentiles (P50, P95, P99)
   - Computes error rates
   - Stores aggregated metrics

2. **PROCESS_METRICS**: Processes existing metrics (legacy)

   - Similar to PROCESS_RAW_METRICS

3. **CLEANUP_LOGS**: Removes old log entries

   - Configurable retention period (default: 30 days)
   - Batch processing
   - Soft delete support

4. **HEALTH_CHECK**: Performs health checks
   - Database connectivity
   - Queue availability
   - Scheduler status

### Queue System

#### Production (SQS)

```typescript
// Enqueue job to SQS
await enqueueJob(
  JobType.PROCESS_RAW_METRICS,
  {
    metrics: rawMetricsArray,
  },
  {
    maxAttempts: 3,
    delay: 5000, // 5 seconds
  }
);
```

#### Development (Local)

The local queue uses an in-memory queue with HTTP endpoint:

```typescript
// Enqueue job to local worker
await enqueueJob(JobType.PROCESS_RAW_METRICS, {
  metrics: rawMetricsArray,
});
```

The worker polls the local queue and processes jobs.

### CRON Scheduling

Default scheduled jobs:

- **Health Check**: Every hour (`0 * * * *`)
- **Log Cleanup**: Daily at midnight (`0 0 * * *`)
- **Metrics Processing**: Every 15 minutes (`*/15 * * * *`)

Jobs are defined in `apps/worker/src/scheduler/jobs.ts`.

### Job Processing Flow

```mermaid
sequenceDiagram
    participant API
    participant Queue
    participant Worker
    participant Handler
    participant DB

    API->>Queue: Enqueue Job
    Queue->>Worker: Poll Job
    Worker->>Handler: Process Job
    Handler->>DB: Write Results
    Handler-->>Worker: Success/Failure
    alt Success
        Worker->>Queue: Acknowledge
    else Failure & Retries < Max
        Worker->>Queue: Retry (exponential backoff)
    else Failure & Retries >= Max
        Worker->>Queue: Dead Letter
    end
```

### Adding New Jobs

1. **Define Job Type** (`apps/worker/src/jobs/types.ts`):

   ```typescript
   export enum JobType {
     MY_NEW_JOB = "MY_NEW_JOB",
   }
   ```

2. **Create Handler** (`apps/worker/src/jobs/handlers/myNewJob.ts`):

   ```typescript
   export async function myNewJob(payload: MyPayload): Promise<void> {
     // Job logic
   }
   ```

3. **Register Handler** (`apps/worker/src/jobs/registry.ts`):

   ```typescript
   const handlers: JobHandlerMap = {
     [JobType.MY_NEW_JOB]: myNewJob,
     // ...
   };
   ```

4. **Schedule (optional)** (`apps/worker/src/scheduler/jobs.ts`):
   ```typescript
   {
     cronExpression: "0 * * * *",
     jobType: JobType.MY_NEW_JOB,
     payload: {},
     enabled: true,
   }
   ```

## Frontend

### Dashboard

The dashboard (`/dashboard`) provides:

- **KPI Cards**: Error rate, P95 latency, total traffic, average response time
- **Charts**: Traffic over time, performance metrics
- **Recent Logs**: Latest log entries
- **Top Endpoints**: Most requested endpoints
- **Top Countries**: Geographic distribution
- **MCP Debug**: Test MCP endpoint connections

### Real-time Updates

The frontend uses Server-Sent Events (SSE) for real-time updates:

- **Metrics Stream**: `/metrics/stream`
- **Logs Stream**: `/logs/stream`

The Zustand store manages SSE connections and state:

```typescript
// Initialize metrics stream
initMetricsSSE();

// Access metrics in components
const metrics = useAppStore((state) => state.metrics);
```

### Pages

- **Dashboard** (`/dashboard`): Overview with KPIs and charts
- **Logs** (`/dashboard/logs`): Full-page log viewer with filtering
- **Metrics** (`/dashboard/metrics`): Detailed metrics view
- **Replay** (`/dashboard/replay`): Request snapshot browser and replay
- **Worker** (`/dashboard/worker`): Job management interface

### Components

Key components:

- `LogsCard`: Recent logs display
- `LogsTable`: Full log table with filtering
- `MetricsChart`: Interactive charts (Recharts)
- `MetricsCard`: Metrics summary
- `ReplayDialog`: Request replay interface
- `ReplayTable`: Snapshot browser

## Deployment

### Infrastructure as Code (Pulumi)

The infrastructure is defined in `infra/` using Pulumi.

#### Stack Naming

Stacks follow the pattern: `<platform>-<env>`

- `lambda-staging`: Lambda deployment (staging)
- `lambda-prod`: Lambda deployment (production)
- `ecs-staging`: ECS deployment (staging)
- `worker-staging`: Worker deployment (staging)
- `client-staging`: Client deployment (staging)

#### Deploy Backend (Lambda)

```bash
cd infra
pulumi stack select lambda-staging
pulumi up
```

This creates:

- ECR repository
- Lambda function (container image)
- API Gateway (HTTP API)
- IAM roles and permissions

#### Deploy Worker

```bash
cd infra
pulumi stack select worker-staging
pulumi up
```

This creates:

- Lambda function for worker
- SQS queue
- EventBridge rules for CRON
- IAM roles

#### Deploy Client

```bash
cd infra
pulumi stack select client-staging
pulumi up
```

This creates:

- S3 bucket
- CloudFront distribution
- Route 53 (if configured)

### Environment Configuration

Set environment variables in Pulumi config or CI/CD:

```bash
pulumi config set DATABASE_URL "postgresql://..."
pulumi config set LOG_LEVEL "info"
pulumi config set AWS_REGION "us-east-1"
```

### Docker Images

The Lambda functions use container images. Build and push:

```bash
# Build image
docker build -t api-lambda -f .docker/Dockerfile.lambda .

# Tag and push (handled by Pulumi)
```

### Cloudflare Workers

The backend also supports Cloudflare Workers:

```typescript
// apps/backend/src/servers/cloudflareworker.ts
export default {
  fetch: app.fetch,
};
```

Deploy using Wrangler or Cloudflare dashboard.

## Configuration

### Environment Variables

#### Backend (`apps/backend/.env`)

| Variable        | Description                  | Required | Default       |
| --------------- | ---------------------------- | -------- | ------------- |
| `NODE_ENV`      | Environment                  | No       | `development` |
| `PORT`          | Server port                  | No       | `3000`        |
| `LOG_LEVEL`     | Log level                    | Yes      | -             |
| `DATABASE_URL`  | PostgreSQL connection string | Yes      | -             |
| `WORKER_URL`    | Worker HTTP endpoint (dev)   | No       | -             |
| `SQS_QUEUE_URL` | SQS queue URL (prod)         | No       | -             |
| `AWS_REGION`    | AWS region                   | No       | -             |

#### Worker (`apps/worker/.env`)

| Variable        | Description                  | Required | Default       |
| --------------- | ---------------------------- | -------- | ------------- |
| `NODE_ENV`      | Environment                  | No       | `development` |
| `WORKER_MODE`   | `local` or `lambda`          | No       | `local`       |
| `LOG_LEVEL`     | Log level                    | Yes      | -             |
| `PORT`          | HTTP server port (local)     | No       | `8081`        |
| `DATABASE_URL`  | PostgreSQL connection string | Yes      | -             |
| `SQS_QUEUE_URL` | SQS queue URL (prod)         | No       | -             |
| `AWS_REGION`    | AWS region                   | No       | -             |

#### Client (`apps/client/.env`)

| Variable       | Description     | Required | Default                 |
| -------------- | --------------- | -------- | ----------------------- |
| `VITE_API_URL` | Backend API URL | No       | `http://localhost:3000` |

### Database Configuration

PostgreSQL connection string format:

```
postgresql://username:password@host:port/database
```

Required extensions:

- `vector` (for pgvector)

### Logging Configuration

Log levels (from most to least verbose):

- `trace`
- `debug`
- `info`
- `warn`
- `error`
- `fatal`
- `silent`

Set via `LOG_LEVEL` environment variable.

## Contributing

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Formatting**: Prettier (if configured)
- **Imports**: Use `@/` alias for `src/`

### Development Workflow

1. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**

   - Follow existing code patterns
   - Use QueryBuilder for database operations
   - Add tests for new features

3. **Test locally**

   ```bash
   bun run test
   bun run dev
   ```

4. **Commit**

   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push and create PR**

### Testing Guidelines

- Write tests for:

  - QueryBuilder operations
  - Job handlers
  - API route handlers
  - Utility functions

- Test files should be in `tests/` directories
- Use Bun's built-in test runner

### Database Changes

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

### Adding New Routes

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

---

## License

[Add your license here]

## Support

[Add support information here]
