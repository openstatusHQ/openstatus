# OpenStatus Docker Self-Hosting Guide

This guide will help you self-host OpenStatus using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your system
- At least 4GB RAM available
- 10GB+ disk space

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/openstatusHQ/openstatus.git
   cd openstatus
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the services**
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**
   ```bash
   # Wait for services to start, then run migrations
   docker-compose exec web pnpm dx
   ```

5. **Access the application**
   - Web App: http://localhost:3000
   - Dashboard: http://localhost:3001
   - API Server: http://localhost:8000

## Services Overview

| Service | Port | Description |
|---------|------|-----------|
| `web` | 3000 | Main web application (Next.js) |
| `dashboard` | 3001 | Admin/user dashboard |
| `server` | 8000 | Backend API server |
| `checker` | - | Monitoring service (background) |
| `workflows` | - | Workflow automation (background) |
| `turso` | 8080 | LibSQL database (dependency) |
| `redis` | 6379 | Redis cache (dependency) |

## Configuration

### Required Environment Variables

The following variables must be configured in your `.env` file:

```bash
# Database
DATABASE_URL=libsql://turso:8080

# Redis
REDIS_URL=redis://redis:6379

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-nextauth-secret-here-change-this

# Application
NODE_ENV=production
NEXT_PUBLIC_URL=http://localhost:3000
```

### Optional Services

For full functionality, configure these optional services:

- **Email notifications**: Configure Resend API
- **SMS notifications**: Configure Twilio
- **OAuth**: Configure GitHub/Google OAuth
- **Analytics**: Configure TinyBird
- **Payments**: Configure Stripe
- **File storage**: Configure Vercel Blob

## Production Deployment

### Security Considerations

1. **Change default secrets**
   ```bash
   # Generate secure secrets
   openssl rand -hex 32  # For NEXTAUTH_SECRET
   openssl rand -hex 16  # For ENCRYPTION_KEY
   ```

2. **Use HTTPS**
   - Set up a reverse proxy (nginx/Traefik)
   - Configure SSL certificates
   - Update `NEXTAUTH_URL` to use HTTPS

3. **Database security**
   - Use external managed database for production
   - Enable authentication on Redis
   - Regular backups

### Scaling

For high-traffic deployments:

1. **Use external services**
   ```bash
   # Use managed database
   DATABASE_URL=libsql://your-database.turso.io?authToken=token
   
   # Use managed Redis
   REDIS_URL=redis://your-redis-host:6379
   ```

2. **Scale services**
   ```bash
   # Scale checker service
   docker-compose up -d --scale checker=3
   ```

## Maintenance

### Backup

```bash
# Backup database
docker-compose exec turso sqlite3 /var/lib/sqld/data.db ".backup /tmp/backup.db"
docker cp openstatus-turso:/tmp/backup.db ./backup-$(date +%Y%m%d).db

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
```

### Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker-compose build --no-cache
docker-compose up -d

# Run migrations if needed
docker-compose exec web pnpm dx
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f web
docker-compose logs -f checker
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check service status
   docker-compose ps
   
   # Check logs
   docker-compose logs [service-name]
   ```

2. **Database connection issues**
   ```bash
   # Verify Turso is running
   docker-compose exec turso sqlite3 /var/lib/sqld/data.db ".tables"
   ```

3. **Port conflicts**
   ```bash
   # Check if ports are in use
   netstat -tulpn | grep :3000
   
   # Modify ports in docker-compose.yml if needed
   ```

### Health Checks

```bash
# Check web app
curl http://localhost:3000/api/health

# Check API server
curl http://localhost:8000/health

# Check database
docker-compose exec turso sqlite3 /var/lib/sqld/data.db "SELECT 1"
```

## Development

For development with Docker:

```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up -d

# Or override specific services
docker-compose up -d turso redis
# Then run other services locally
```

## Support

- GitHub Issues: https://github.com/openstatusHQ/openstatus/issues
- Documentation: https://docs.openstatus.dev
- Discord: https://discord.gg/openstatus
