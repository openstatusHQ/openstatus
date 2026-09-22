# Docker Setup Guide

Complete guide for running OpenStatus with Docker

## Quick Start

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Configure required variables (see Configuration section)
vim .env.docker

# 3. Build and start services (the db-migrate one-shot applies migrations before apps start)
export DOCKER_BUILDKIT=1
docker compose up -d

# 4. Check service health
docker compose ps

# 5. (Optional) Seed database with test data (uses libsql's host-published
#    port — seed refuses non-localhost databases by design)
docker run --rm --network host \
  -e DATABASE_URL=http://localhost:8080 \
  --entrypoint deno openstatus/db-migrate:latest task seed

# 6. (Optional) Deploy Tinybird local - requires tb CLI
cd packages/tinybird
tb --local deploy

# 7. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Page Theme Explorer
# Note: Status pages are accessed via subdomain/slug (e.g., http://localhost:3003/status)
```

## Cleanup

```bash
# Remove stopped containers
docker compose down

# Remove volumes
docker compose down -v

# Clean build cache
docker builder prune
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| db-migrate | — | One-shot DB migrations (exits after applying) |
| workflows | 3000 | Background jobs |
| server | 3001 | API backend (tRPC) |
| dashboard | 3002 | Admin interface |
| status-page | 3003 | Public status pages |
| private-location | 8081 | Monitoring agent |
| libsql | 8080 | Database (HTTP) |
| libsql | 5001 | Database (gRPC) |
| tinybird-local | 7181 | Analytics |


## Architecture

```
┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│   Server    │
│  (Next.js)  │     │   (Bun)     │
└─────────────┘     └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ Status Page │     │  Workflows  │
│  (Next.js)  │     │   (Bun)     │
└─────────────┘     └─────────────┘
      │                    │
      └────────┬───────────┘
               ▼
        ┌─────────────┐
        │   LibSQL    │
        │  (Database) │
        └─────────────┘
```

## Database Setup

### Automatic Migrations

Migrations run **automatically** when you start the stack with `docker compose up -d`: the `db-migrate` one-shot service applies all drizzle migrations and exits before the app services boot (they wait on its `service_completed_successfully` condition). Re-running `docker compose up -d` is safe — drizzle records applied migrations in the `__drizzle_migrations` table and skips them on subsequent runs.

**Verifying migrations:**
```bash
docker compose logs db-migrate

# Should show:
# openstatus-db-migrate  | Running migrations
# openstatus-db-migrate  | Migrated successfully
```

**Manual migration:**

If you need to re-run migrations or troubleshoot:

```bash
docker compose run --rm db-migrate
```

**Troubleshooting `no such table` errors:**

A `SQLITE_UNKNOWN: no such table` error from dashboard or status-page means the database is unmigrated. Check `docker compose logs db-migrate` for the failure — common causes are a wrong `DATABASE_AUTH_TOKEN` in `.env.docker` or libsql not being healthy. (`DATABASE_URL` is pinned to `http://libsql:8080` by the compose files, so it cannot be misconfigured via `.env.docker`.) Fix the cause, then run `docker compose up -d` again.

### Seeding Test Data (Optional)

**Note:** Migrations run automatically, but seeding does **not**. You must manually seed the database if you want test data.

After migrations complete, seed the database with sample data:

```bash
# Uses libsql's host-published port 8080 — seed refuses non-localhost
# databases by design, so it cannot run over the compose-internal network
docker run --rm --network host \
  -e DATABASE_URL=http://localhost:8080 \
  --entrypoint deno openstatus/db-migrate:latest task seed
```

This creates:
- 3 workspaces (`love-openstatus`, `test2`, `test3`)
- Sample monitors and 2 status pages (slugs `status` and `acme`)
- Test user account: `ping@openstatus.dev`
- Sample incidents, status reports, and maintenance windows

**Verifying seeded data:**
```bash
# Check table counts via libsql HTTP API
curl -s http://localhost:8080/ -H "Content-Type: application/json" \
  -d '{"statements":["SELECT COUNT(*) FROM page"]}' | jq -r '.[0].results.rows[0][0]'

# Should output: 2
```

**Accessing Seeded Data:**

After seeding, you can access the test data:

**Dashboard:**
1. Navigate to http://localhost:3002/login
2. Use magic link authentication with email: `ping@openstatus.dev`
3. Check your console/logs for the magic link (with `SELF_HOST=true` in `.env.docker`)
4. After logging in, you'll see the `love-openstatus` workspace with all seeded monitors and status page

**Status Page:**
- The seeded status page has slug `status`
- Access it via subdomain routing: http://status.localhost:3003
- Or view theme explorer at: http://localhost:3003

**If you use a different email address**, the system will create a new empty workspace for you instead of showing the seeded data. To access seeded data with a different account, you must add your user to the seeded workspace using SQL:

  ```bash
  # First, find your user_id
  curl -X POST http://localhost:8080/ -H "Content-Type: application/json" \
    -d '{"statements":["SELECT id, email FROM user"]}'

  # Then add association (replace USER_ID with your id)
  curl -X POST http://localhost:8080/ -H "Content-Type: application/json" \
    -d '{"statements":["INSERT INTO users_to_workspaces (user_id, workspace_id, role) VALUES (USER_ID, 1, '\''owner'\'')"]}'
  ```


## Tinybird Setup (Optional)

Tinybird is used for analytics and monitoring metrics. The application will work without it, but analytics features will be unavailable.

If you want to enable analytics, you can:
1. Use Tinybird Cloud and configure `TINY_BIRD_API_KEY` in `.env.docker`
2. Manually configure Tinybird Local (requires additional setup beyond this guide)

## Configuration

### Required Environment Variables

Edit `.env.docker` and set:

```bash
# Authentication
AUTH_SECRET=your-secret-here

# Database
DATABASE_URL=http://libsql:8080
DATABASE_AUTH_TOKEN=basic:token

# Email
RESEND_API_KEY=test
```

### Optional Services

Configure these for full functionality:

```bash
# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Analytics
TINY_BIRD_API_KEY=

# OAuth providers
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

See [.env.docker.example](.env.docker.example) for complete list.

## Development Workflow

### Common Commands

```bash
# View logs
docker compose logs -f [service-name]

# Restart service
docker compose restart [service-name]

# Rebuild after code changes
docker compose up -d --build [service-name]

# Stop all services
docker compose down

# Reset database (removes all data)
docker compose down -v
docker compose up -d
# Migrations run automatically on startup
```

### Authentication

**Magic Link**:

Set `SELF_HOST=true` in `.env.docker` to enable email-based magic link authentication. This allows users to sign in without configuring OAuth providers.

**OAuth Providers**:

Configure GitHub/Google OAuth credentials in `.env.docker` and set up callback URLs:
  - GitHub: `http://localhost:3002/api/auth/callback/github`
  - Google: `http://localhost:3002/api/auth/callback/google`

### Creating Status Pages

**Via Dashboard (Recommended)**:
1. Login to http://localhost:3002
2. Create a workspace
3. Create a status page with a slug
4. Access at http://localhost:3003/[slug]

**Via Database (Testing)**:
```bash
# Insert test data
curl -s http://localhost:8080/v2/pipeline \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "requests":[{
      "type":"execute",
      "stmt":{
        "sql":"INSERT INTO workspace (id, slug, name) VALUES (1, '\''test'\'', '\''Test Workspace'\'');"
      }
    }]
  }'
```

### Resource Limits

Add to `docker-compose.yaml`:

```yaml
services:
  dashboard:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Monitoring

### Health Checks

All services have automated health checks:

```bash
# View health status
docker compose ps

# Inspect specific service
docker inspect openstatus-dashboard --format='{{.State.Health.Status}}'
```

## Getting Help

- **Documentation**: [docs.openstatus.dev](https://www.openstatus.dev/docs)
- **Discord**: [openstatus.dev/discord](https://www.openstatus.dev/discord)
- **GitHub Issues**: [github.com/openstatusHQ/openstatus/issues](https://github.com/openstatusHQ/openstatus/issues)
