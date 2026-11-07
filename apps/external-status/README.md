# External Status

Polls the status pages of third-party services, stores their incidents and
components in Turso and publishes status snapshots to Tinybird.

Two cron endpoints, both guarded by `Authorization: $CRON_SECRET`:

- `GET /cron/external-status` — fetch status, incidents and components for every external service
- `GET /cron/external-incidents-prune` — drop raw payloads of long-resolved incidents

## Development

```sh
pnpm install
CRON_SECRET=dev pnpm dev
```

`CRON_SECRET` is required; the server refuses to start without it.

open <http://localhost:3000>

## Deploy

From root

```bash
flyctl deploy --config apps/external-status/fly.toml --dockerfile apps/external-status/Dockerfile
```

Secrets: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TINY_BIRD_API_KEY`, `CRON_SECRET`,
`SENTRY_DSN`, `AXIOM_TOKEN`, `AXIOM_DATASET`.

## Docker

The Dockerfile is generated with [Dofigen](https://github.com/lenra-io/dofigen).
From the `apps/external-status` directory:

```bash
cargo install dofigen
dofigen update
dofigen gen
```
