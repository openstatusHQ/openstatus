# Coolify Deployment Guide

This guide explains how to deploy OpenStatus using Coolify with pre-built Docker images from GitHub Container Registry.

## Prerequisites

- Coolify instance (self-hosted or cloud)
- GitHub account with access to the repository
- Environment variables configured

## Available Docker Images

All images are published to `ghcr.io/openstatusHQ/openstatus-*`:

- `ghcr.io/openstatusHQ/openstatus-server:latest` - Main API server
- `ghcr.io/openstatusHQ/openstatus-dashboard:latest` - Web dashboard
- `ghcr.io/openstatusHQ/openstatus-workflows:latest` - Workflow engine
- `ghcr.io/openstatusHQ/openstatus-private-location:latest` - Private monitoring agent
- `ghcr.io/openstatusHQ/openstatus-status-page:latest` - Public status page
- `ghcr.io/openstatusHQ/openstatus-checker:latest` - Monitoring checker service

## Coolify Setup

### 1. Create a New Application

1. In Coolify, click "Add New" → "Application"
2. Choose "Docker" as the application type
3. Select "Public Repository" for the image source

### 2. Configure Each Service

#### Server Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-server:latest`
- **Port**: 3000
- **Environment Variables**:
  ```yaml
  DATABASE_URL: http://libsql:8080
  PORT: 3000
  # Add other required variables from .env.docker
  ```

#### Dashboard Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-dashboard:latest`
- **Port**: 3000
- **Environment Variables**:
  ```yaml
  DATABASE_URL: http://libsql:8080
  PORT: 3000
  HOSTNAME: 0.0.0.0
  AUTH_TRUST_HOST: true
  ```

#### Workflows Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-workflows:latest`
- **Port**: 3000
- **Environment Variables**:
  ```yaml
  DATABASE_URL: http://libsql:8080
  PORT: 3000
  ```

#### Private Location Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-private-location:latest`
- **Port**: 8080
- **Environment Variables**:
  ```yaml
  DB_URL: http://libsql:8080
  TINYBIRD_URL: http://tinybird-local:7181
  GIN_MODE: release
  PORT: 8080
  ```

#### Checker Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-checker:latest`
- **Port**: 8080
- **Environment Variables**:
  ```yaml
  DATABASE_URL: http://libsql:8080
  PORT: 8080
  ```

#### Status Page Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-status-page:latest`
- **Port**: 3000
- **Environment Variables**:
  ```yaml
  DATABASE_URL: http://libsql:8080
  PORT: 3000
  HOSTNAME: 0.0.0.0
  AUTH_TRUST_HOST: true
  ```

### 3. External Dependencies

#### LibSQL Database
- **Image**: `ghcr.io/tursodatabase/libsql-server:latest`
- **Port**: 8080
- **Environment Variables**:
  ```yaml
  SQLD_NODE: primary
  ```

#### TinyBird (Optional)
- **Image**: `tinybirdco/tinybird-local:latest`
- **Port**: 7181
- **Environment Variables**:
  ```yaml
  COMPATIBILITY_MODE: 1
  ```

### 4. Network Configuration

1. Create a shared network for all services
2. Ensure services can communicate using container names
3. Configure health checks for each service

### 5. Deployment Order

Deploy services in this order:
1. LibSQL (database)
2. TinyBird (if used)
3. Workflows
4. Server
5. Private Location
6. Checker
7. Dashboard
8. Status Page

## Environment Variables

Create a `.env` file with all required variables. Refer to `.env.docker.example` in the repository for the complete list.

## Health Checks

All images include built-in health checks:
- **Server/Workflows**: `curl -f http://localhost:3000/ping`
- **Dashboard/Status Page**: `curl -f http://localhost:3000/`
- **Private Location**: `wget --spider -q http://localhost:8080/health`
- **Checker**: `curl -f http://localhost:8080/health`

## Version Management

- `latest` tag points to the latest main branch build
- Development builds use `dev-latest` tag
- Specific commits are tagged with their SHA
- Use specific tags for production deployments

## Troubleshooting

### Image Pull Issues
Ensure Coolify has access to GitHub Container Registry:
1. Add GitHub token as a registry credential in Coolify
2. Use `GITHUB_TOKEN` with `packages: read` permissions

### Service Communication
- Verify all services are on the same network
- Check container names match the configuration
- Ensure ports are correctly mapped

### Database Connection
- Wait for LibSQL to be fully healthy before starting other services
- Verify the DATABASE_URL format: `http://libsql:8080`

## Updates

Images are automatically built and pushed when:
- Code is pushed to the main branch
- Manual workflow dispatch is triggered
- Weekly maintenance runs (Sundays 2 AM UTC)

To update in Coolify:
1. Pull new images
2. Redeploy services in the correct order
3. Verify health checks pass

## Support

- Check the GitHub Actions workflows for build status
- Review container logs in Coolify
- Open an issue for deployment problems
