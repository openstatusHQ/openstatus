# External Status

Polls the status pages of third-party services, stores their incidents and
components in Turso and publishes status snapshots to Tinybird.

Two jobs, scheduled in-process with Effect's cron scheduler (`src/scheduler.ts`):

- `external-status`, every 10 minutes — fetch status, incidents and components for every external service
- `external-incidents-prune`, daily — drop raw payloads of long-resolved incidents

Both also run once at startup. The only HTTP route is `/ping`, for health checks.

## Development

```sh
pnpm install
pnpm dev
```

open <http://localhost:3000>

## Deploy

From root

```bash
flyctl deploy --config apps/external-status/fly.toml --dockerfile apps/external-status/Dockerfile
```

Secrets: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TINY_BIRD_API_KEY`, `SENTRY_DSN`,
`AXIOM_TOKEN`, `AXIOM_DATASET`.

## Docker

The Dockerfile is generated with [Dofigen](https://github.com/lenra-io/dofigen).
From the `apps/external-status` directory:

```bash
cargo install dofigen
dofigen update
dofigen gen
```
