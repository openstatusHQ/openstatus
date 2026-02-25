# Coolify Setup Guide

This guide provides step-by-step instructions for deploying OpenStatus on Coolify using pre-built Docker images.

## Quick Start

### Option 1: Import Complete Stack

1. In Coolify dashboard, click **"New Service"** → **"Docker Compose"**
2. Choose **"Import from URL"** and enter:
   ```
   https://raw.githubusercontent.com/openstatusHQ/openstatus/main/coolify-deployment.yaml
   ```
3. Configure your environment variables
4. Click **"Deploy"**

### Option 2: Import with Environment Validation

1. In Coolify dashboard, click **"New Service"** → **"Docker Compose"**
2. Choose **"Import from URL"** and enter:
   ```
   https://raw.githubusercontent.com/openstatusHQ/openstatus/main/docker-compose.env-check.yaml
   ```
3. This version includes environment validation
4. Configure your environment variables
5. Click **"Deploy"**

### Option 3: Manual Service Setup

Create each service individually using the configurations below.

## Environment Setup

### Automatic Setup

1. **Clone the repository** to your local machine
2. **Run the setup script**:
   ```bash
   ./setup-env.sh
   ```
3. **Follow the prompts** to configure required variables
4. **Upload .env.docker** to Coolify secrets

### Manual Setup

1. **Copy the example file**:
   ```bash
   cp .env.docker.example .env.docker
   ```
2. **Edit the file** with your values:
   ```bash
   nano .env.docker
   ```
3. **Required variables**:
   - `DATABASE_URL=http://libsql:8080`
   - `AUTH_SECRET=your-32-char-secret`
   - `RESEND_API_KEY=your-resend-key`
   - `NEXT_PUBLIC_URL=http://your-domain:3002`

### Environment Validation

The `docker-compose.env-check.yaml` file includes:
- **Pre-start validation** of .env.docker existence
- **Required variable checks** before service startup
- **Clear error messages** for missing configuration
- **Dependency management** with validation service

## Service Configurations

### 1. Database Services

#### LibSQL Database
- **Image**: `ghcr.io/tursodatabase/libsql-server:latest`
- **Name**: `openstatus-libsql`
- **Port**: `8080`
- **Environment Variables**:
  ```
  SQLD_NODE=primary
  ```
- **Volumes**: `openstatus-libsql-data:/var/lib/sqld`
- **Health Check**: `curl -f http://localhost:8080`

#### TinyBird (Optional)
- **Image**: `tinybirdco/tinybird-local:latest`
- **Name**: `openstatus-tinybird`
- **Port**: `7181`
- **Environment Variables**:
  ```
  COMPATIBILITY_MODE=1
  ```

### 2. Core Services

#### Workflows Engine
- **Image**: `ghcr.io/openstatusHQ/openstatus-workflows:latest`
- **Name**: `openstatus-workflows`
- **Port**: `3000`
- **Environment Variables**:
  ```
  DATABASE_URL=http://libsql:8080
  PORT=3000
  NODE_ENV=production
  ```
- **Volumes**: `./data:/app/data`
- **Depends On**: `openstatus-libsql`

#### API Server
- **Image**: `ghcr.io/openstatusHQ/openstatus-server:latest`
- **Name**: `openstatus-server`
- **Port**: `3001`
- **Environment Variables**:
  ```
  DATABASE_URL=http://libsql:8080
  PORT=3000
  NODE_ENV=production
  ```
- **Depends On**: `openstatus-workflows`, `openstatus-libsql`

#### Private Location Agent
- **Image**: `ghcr.io/openstatusHQ/openstatus-private-location:latest`
- **Name**: `openstatus-private-location`
- **Port**: `8081`
- **Environment Variables**:
  ```
  DB_URL=http://libsql:8080
  TINYBIRD_URL=http://tinybird:7181
  GIN_MODE=release
  PORT=8080
  NODE_ENV=production
  ```
- **Depends On**: `openstatus-server`

#### Checker Service
- **Image**: `ghcr.io/openstatusHQ/openstatus-checker:latest`
- **Name**: `openstatus-checker`
- **Port**: `8082`
- **Environment Variables**:
  ```
  DATABASE_URL=http://libsql:8080
  PORT=8080
  NODE_ENV=production
  ```
- **Depends On**: `openstatus-server`

#### Web Dashboard
- **Image**: `ghcr.io/openstatusHQ/openstatus-dashboard:latest`
- **Name**: `openstatus-dashboard`
- **Port**: `3002`
- **Environment Variables**:
  ```
  DATABASE_URL=http://libsql:8080
  PORT=3000
  HOSTNAME=0.0.0.0
  AUTH_TRUST_HOST=true
  NODE_ENV=production
  ```
- **Depends On**: `openstatus-workflows`, `openstatus-libsql`, `openstatus-server`

#### Status Page
- **Image**: `ghcr.io/openstatusHQ/openstatus-status-page:latest`
- **Name**: `openstatus-status-page`
- **Port**: `3003`
- **Environment Variables**:
  ```
  DATABASE_URL=http://libsql:8080
  PORT=3000
  HOSTNAME=0.0.0.0
  AUTH_TRUST_HOST=true
  NODE_ENV=production
  ```
- **Depends On**: `openstatus-workflows`, `openstatus-libsql`, `openstatus-server`

## Environment Variables

Create a `.env.docker` file with the following variables:

```bash
# Database
DATABASE_URL=http://libsql:8080

# Authentication
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3002

# External Services
RESEND_API_KEY=your-resend-api-key
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# TinyBird
TINYBIRD_TOKEN=your-tinybird-token
TINYBIRD_URL=http://tinybird:7181

# Other
ENCRYPTION_KEY=your-encryption-key
```

## Network Configuration

1. **Create Network**: In Coolify, create a network named `openstatus`
2. **Attach Services**: Ensure all services are attached to this network
3. **Service Discovery**: Services can communicate using container names as hostnames

## Deployment Order

Deploy services in this sequence:

1. **libsql** (Database)
2. **tinybird** (Optional - Analytics)
3. **workflows** (Workflow Engine)
4. **server** (API Server)
5. **private-location** (Monitoring Agent)
6. **checker** (Health Checker)
7. **dashboard** (Web Interface)
8. **status-page** (Public Status)

## Resource Allocation

Recommended resource limits for each service:

| Service | Memory Limit | Memory Reservation |
|----------|---------------|-------------------|
| libsql | 512MB | 256MB |
| tinybird | 1GB | 512MB |
| workflows | 512MB | 256MB |
| server | 512MB | 256MB |
| private-location | 256MB | 128MB |
| checker | 256MB | 128MB |
| dashboard | 512MB | 256MB |
| status-page | 512MB | 256MB |

## Health Checks

All services include built-in health checks:

- **API Services**: `curl -f http://localhost:3000/ping`
- **Web Services**: `curl -f http://localhost:3000/`
- **Private Location**: `wget --spider -q http://localhost:8080/health`

## Access URLs

After deployment, access services at:

- **Dashboard**: `http://your-domain:3002`
- **API Server**: `http://your-domain:3001`
- **Status Page**: `http://your-domain:3003`
- **Workflows**: `http://your-domain:3000`

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   - Check environment variables
   - Verify network connectivity
   - Review service logs

2. **Database Connection Failed**
   - Ensure libsql is healthy first
   - Check DATABASE_URL format
   - Verify network configuration

3. **Health Check Failing**
   - Wait for full startup (30-60 seconds)
   - Check if required ports are available
   - Review service dependencies

### Log Locations

In Coolify, access logs via:
1. Service → **Logs** tab
2. **Real-time** streaming logs
3. **Historical** log files

### Updates

To update services:
1. Pull new images in Coolify
2. Redeploy affected services
3. Verify health checks pass

## Production Considerations

1. **SSL/TLS**: Configure HTTPS in Coolify
2. **Backups**: Enable automated backups for database
3. **Monitoring**: Set up external monitoring
4. **Scaling**: Configure resource limits based on usage
5. **Security**: Update images regularly, use secrets management

## Support

- **Documentation**: [OpenStatus Docs](https://docs.openstatus.dev)
- **Issues**: [GitHub Issues](https://github.com/openstatusHQ/openstatus/issues)
- **Community**: [Discord](https://www.openstatus.dev/discord)
