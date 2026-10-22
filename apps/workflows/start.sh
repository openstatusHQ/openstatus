#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/db && node src/migrate.mts

echo "Starting workflows service..."
cd /app/apps/workflows
exec node /app/apps/workflows/dist/serve.mjs
