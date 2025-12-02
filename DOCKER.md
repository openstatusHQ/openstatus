# Docker Setup Guide

Complete guide for running OpenStatus with Docker

## Quick Start

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Configure required variables (see Configuration section)
vim .env.docker

# 3. Build and start services
export DOCKER_BUILDKIT=1
docker-compose up -d

# 4. Check service health
docker-compose ps

# 5. Run database migrations (required)
cd packages/db
pnpm migrate

# 6. Seed database with test data (optional)
pnpm seed

# 7. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Pages
```

## Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove volumes
docker-compose down -v

# Clean build cache
docker builder prune
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
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

The LibSQL container starts with an empty database. You must run migrations before using the application:

```bash
cd packages/db
pnpm migrate
```

### Seeding Test Data (Optional)

For development, you can populate the database with sample data:

```bash
cd packages/db
pnpm seed
```

This creates:
- 3 workspaces (`love-openstatus`, `test2`, `test3`)
- Sample monitors and status pages
- Test user (`ping@openstatus.dev`)
- Sample incidents and maintenance windows

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
docker-compose logs -f [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild after code changes
docker-compose up -d --build [service-name]

# Stop all services
docker-compose down

# Reset database (removes all data)
docker-compose down -v
# After resetting, re-run migrations:
# cd packages/db && pnpm migrate
```

### Authentication

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
docker-compose ps

# Inspect specific service
docker inspect openstatus-dashboard --format='{{.State.Health.Status}}'
```

## Getting Help

- **Documentation**: [docs.openstatus.dev](https://docs.openstatus.dev)
- **Discord**: [openstatus.dev/discord](https://www.openstatus.dev/discord)
- **GitHub Issues**: [github.com/openstatusHQ/openstatus/issues](https://github.com/openstatusHQ/openstatus/issues)
