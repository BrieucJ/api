# Health Check Endpoints

Comprehensive health check system for monitoring API and dependency health.

## Endpoints

### 1. `/health` - Overall Health Check
**Comprehensive health check including all dependencies**

```bash
curl http://localhost:3000/health
```

**Response (200 OK - Healthy)**:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "connected": true
    },
    "worker": {
      "status": "healthy",
      "workerMode": "lambda",
      "lastHeartbeat": "2024-01-01T00:00:00.000Z",
      "heartbeatAge": 30,
      "queueSize": 5,
      "processingCount": 2
    }
  },
  "error": null,
  "metadata": null
}
```

**Status Values**:
- `healthy` - All systems operational
- `degraded` - Non-critical systems unhealthy (e.g., worker issues)
- `unhealthy` - Critical systems down (e.g., database)

---

### 2. `/health/liveness` - Liveness Probe
**Basic liveness check - returns 200 if the API is running**

Used by Kubernetes/Docker for liveness probes. Only checks if the API process is alive.

```bash
curl http://localhost:3000/health/liveness
```

**Response (200 OK)**:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600
  },
  "error": null,
  "metadata": null
}
```

---

### 3. `/health/readiness` - Readiness Probe
**Readiness check - verifies all dependencies are ready**

Used by Kubernetes/load balancers to determine if the API can accept traffic.

```bash
curl http://localhost:3000/health/readiness
```

**Response (200 OK - Ready)**:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "connected": true
    },
    "worker": {
      "status": "healthy",
      "workerMode": "lambda",
      "lastHeartbeat": "2024-01-01T00:00:00.000Z",
      "heartbeatAge": 30,
      "queueSize": 5,
      "processingCount": 2
    }
  },
  "error": null,
  "metadata": null
}
```

**Response (503 Service Unavailable - Not Ready)**:
```json
{
  "data": {
    "status": "unhealthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "database": {
      "status": "unhealthy",
      "responseTime": 5000,
      "connected": false,
      "error": "Connection timeout"
    },
    "worker": {
      "status": "unknown",
      "workerMode": "unknown",
      "error": "No worker heartbeat detected"
    }
  },
  "error": null,
  "metadata": null
}
```

---

### 4. `/health/database` - Database Health Check
**Checks database connectivity and response time**

```bash
curl http://localhost:3000/health/database
```

**Response (200 OK - Healthy)**:
```json
{
  "data": {
    "status": "healthy",
    "responseTime": 15,
    "connected": true
  },
  "error": null,
  "metadata": null
}
```

**Response (503 Service Unavailable - Unhealthy)**:
```json
{
  "data": {
    "status": "unhealthy",
    "responseTime": 5000,
    "connected": false,
    "error": "Connection timeout"
  },
  "error": null,
  "metadata": null
}
```

---

### 5. `/health/worker` - Worker Health Check
**Checks worker status via heartbeat and queue metrics**

```bash
curl http://localhost:3000/health/worker
```

**Response (200 OK - Healthy)**:
```json
{
  "data": {
    "status": "healthy",
    "workerMode": "lambda",
    "lastHeartbeat": "2024-01-01T00:00:00.000Z",
    "heartbeatAge": 30,
    "queueSize": 5,
    "processingCount": 2
  },
  "error": null,
  "metadata": null
}
```

**Response (503 Service Unavailable - Unhealthy)**:
```json
{
  "data": {
    "status": "unhealthy",
    "workerMode": "lambda",
    "lastHeartbeat": "2023-12-31T23:00:00.000Z",
    "heartbeatAge": 450,
    "queueSize": 10,
    "processingCount": 0,
    "error": "Worker heartbeat is 450s old (threshold: 300s)"
  },
  "error": null,
  "metadata": null
}
```

---

## Health Status Logic

### Database Health
- **Healthy**: Database query succeeds within reasonable time
- **Unhealthy**: Database connection fails or query times out

### Worker Health
- **Healthy**: Worker heartbeat is less than 5 minutes old
- **Unhealthy**: Worker heartbeat is older than 5 minutes (300 seconds)
- **Unknown**: No worker heartbeat data found in database

### Overall Health
- **Healthy**: Database healthy AND worker healthy
- **Degraded**: Database healthy BUT worker unhealthy/unknown
- **Unhealthy**: Database unhealthy (critical failure)

### Readiness
- **Ready (200)**: Database is healthy (worker health is considered non-critical)
- **Not Ready (503)**: Database is unhealthy

---

## Kubernetes/Docker Configuration

### Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe
```yaml
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Monitoring & Alerting

### Recommended Alerts

1. **Critical: API Down**
   - Condition: `/health/liveness` returns non-200 status
   - Action: Page on-call immediately

2. **Critical: Database Unavailable**
   - Condition: `/health/database` returns 503
   - Action: Page on-call immediately

3. **Warning: Worker Unhealthy**
   - Condition: `/health/worker` returns 503
   - Action: Notify team, investigate queue backlog

4. **Warning: Degraded Mode**
   - Condition: `/health` returns status "degraded"
   - Action: Notify team, monitor closely

### Monitoring Dashboard Queries

```bash
# Check overall health every 30s
watch -n 30 'curl -s http://localhost:3000/health | jq .data.status'

# Check database response time
curl -s http://localhost:3000/health/database | jq .data.responseTime

# Check worker heartbeat age
curl -s http://localhost:3000/health/worker | jq .data.heartbeatAge
```

---

## Implementation Details

- Database health check runs a simple `SELECT 1` query
- Worker health check examines the most recent `worker_stats` heartbeat
- Worker heartbeat threshold: 300 seconds (5 minutes)
- All checks run in parallel for the `/health` and `/health/readiness` endpoints
- Response times include actual query execution time in milliseconds

