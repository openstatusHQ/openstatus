#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/db && bun src/migrate.mts

echo "Starting workflows service..."
cd /app/apps/workflows
exec /app/apps/workflows/app
