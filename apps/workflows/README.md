# Workflows

## Development

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

open <http://localhost:3000>

## Deploy

From root

```bash
flyctl deploy --config apps/workflows/fly.toml --dockerfile  apps/workflows/Dockerfile
```

## Docker

The Dockerfile is generated thanks to [Dofigen](https://github.com/lenra-io/dofigen).
To generate the Dockerfile, run the following command from the `apps/workflows` directory:

```bash
# Install Dofigen
cargo install dofigen
# Update the dependent image versions
dofigen update
# Generate the Dockerfile
dofigen gen
```

## Replica

Hot-path cron reads (`sendCheckerTasks`) go through a local Turso replica managed by [`@tursodatabase/sync`](https://docs.turso.tech/sync/usage) with partial sync. The replica file lives at `/app/data/replica-sync.db` in prod (Fly volume `libsql_data`) and `./dev.db` in development. Writes (`/incident/cleanup`, `/cron/external-incidents-prune`) go directly to Turso Cloud via `@openstatus/db`.

Partial sync bootstraps `monitor`, `maintenance`, `page_component`, `maintenance_to_page_component`, `monitor_status` only. Other tables fetch on demand if ever read (`prefetch: true`). Sync timing: per-cron-tick `db.pull()` (fail-open) plus a 60 s background `pull()` to preserve freshness for long-periodicity monitors.

The pre-migration libsql embedded replica file at `/app/data/replica.db` is orphaned by this change. Cleanup follow-up after stabilization: `fly ssh console` into each machine and `rm -f /app/data/replica.db /app/data/replica.db-*`.

Rollback: revert the migration commit and redeploy. The reverted code re-bootstraps the old `replica.db` from Turso Cloud on first boot; no manual data ops required.
