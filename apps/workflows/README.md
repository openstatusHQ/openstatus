# Workflows

## Development

To install dependencies:

```sh
pnpm install
```

To run:

```sh
pnpm dev
```

open <http://localhost:3000>

## Backfill run verdicts into frozen uptime months

Frozen months older than the runs materialization's 47-day window hold per-region
`requests` only. This adds each day's `runs`, recomputed from raw Tinybird
data, to days that lack them; `requests` and days that already have `runs` are
never changed, so a re-run is a no-op.

Run it after the Tinybird deploy that adds the temporary
`endpoint__*_runs_backfill__v0` pipes (delete them once it has run), with
`DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `TINY_BIRD_API_KEY` set (or in
`apps/workflows/.env`):

```sh
pnpm --filter @openstatus/workflows backfill:uptime-runs -- --from 2025-11 --to 2026-10 --dry-run
pnpm --filter @openstatus/workflows backfill:uptime-runs -- --from 2025-11 --to 2026-10 [--monitor 42]
```

It walks months newest to oldest and stops at the first month with no raw data
for any monitor (past raw retention). Each run is judged against the cloud
regions that reported in it. Failed monitors are listed; run again to retry
them.

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
