# OpenStatus Dashboard

## Manual Setup

### Requirements

- [Node.js](https://nodejs.org/en/) >= 20.0.0 — runtime
- [pnpm](https://pnpm.io/) >= 8 — monorepo package manager (see root `package.json` for pinned version)
- [Deno](https://deno.com/) — runs the db env/migrate/seed scripts in `packages/db`
- [Bun](https://bun.sh/) — optional, used by the utility scripts in `src/scripts`
- [Turso CLI](https://docs.turso.tech/quickstart) — starts the local libSQL server via `pnpm --filter '@openstatus/db' dev`

### Environment

The dashboard, marketing site, and status page resolve application credentials
with the [SecretSpec Node SDK](https://secretspec.dev/sdk/nodejs/) during Next.js
configuration and server startup. Run the normal development and build commands;
no wrapper command is needed. Existing `.env` files keep working without migration.

[SecretSpec supports 35 providers](https://secretspec.dev/), including system
keyrings, 1Password, AWS Secrets Manager, Vault, and Doppler. Teams can choose
their existing secret store without adding provider-specific code to OpenStatus.

Declarations live in `packages/credentials/secretspec.toml`. The root
`secretspec.toml` inherits them for use with the SecretSpec CLI. Development uses
the `development` profile with local dummy credentials; production uses `default`,
which requires `DATABASE_URL` and `AUTH_SECRET` and has no dummy values.

By default, existing process environment values win, followed by `.env` in the
current app or database package directory, then the profile's defaults. The `.env`
fallback fills missing environment values before the SDK resolves its `env://`
provider. Next.js also keeps its usual `.env.local` and environment-specific file
loading and precedence. Existing deployment environment variables and Docker
environment injection keep working; no file or secret-store setup is required.

Select another provider using `SECRETSPEC_PROVIDER` in your shell or deployment
configuration, for example `keyring://` or `onepassword://Development`. An explicit
provider disables the loader's automatic `.env` fallback; missing credentials or
provider errors fail startup rather than silently falling back to that file.
Use `SECRETSPEC_PROVIDER=env://` to resolve only the existing environment through
the SDK. Next.js still performs its own environment-file loading.
`SECRETSPEC_PROFILE` overrides the selected profile. For local defaults without
reading environment credentials, use `SECRETSPEC_PROVIDER=null://`.

Environment credentials, `.env` fallback, and local defaults also work when the
SDK's native addon is unavailable, including on Intel Macs. External secret stores
require a supported native addon; startup reports an error if the selected
provider cannot run.

To optionally move existing values into a secret store, install the
[SecretSpec CLI](https://secretspec.dev/quick-start/)
and run from the repository root:

```sh
secretspec config global init
secretspec import dotenv://apps/dashboard/.env --profile development
```

Then select that provider with `SECRETSPEC_PROVIDER`. You can remove the old `.env`
files after migration so frameworks cannot load stale values. To update an individual value,
run `secretspec set RESEND_API_KEY --profile development`; the CLI prompts for it.
The SDK makes resolved values available to the application's existing validated
environment modules before they initialize.

The database migration and seed commands also resolve their database credentials
automatically. Shared service code and the Deno workflows app continue to consume
process environment credentials, keeping the Node SDK outside their runtime.
Provider authentication variables needed by external stores must be forwarded
through Turbo, for example with `TURBO_ENV_MODE=loose`. After rotating build-time
values in a store, use `pnpm build --force` to bypass Turbo's build cache.
Public `NEXT_PUBLIC_*` values are resolved during the build and remain public.

### Startup

1. Install dependencies

```sh
pnpm install
```

2. Start the libSQL server (keep this terminal running)

```sh
pnpm --filter '@openstatus/db' dev
```

3. In a second terminal, set up the dev database

```sh
pnpm --filter @openstatus/db migrate
pnpm --filter @openstatus/db seed
```

`migrate` runs Drizzle migrations against libSQL. `seed` inserts a default
workspace, user (`ping@openstatus.dev`), monitors, and a status page.

4. Stop the terminal from step 2

`pnpm -w dev:dashboard` starts its own libSQL on port `8080` — leaving the step-2 server running causes a port conflict.

5. Start the dashboard from the repo root

```sh
pnpm dev:dashboard
```

Turbo runs the dashboard (`apps/dashboard`) and `@openstatus/db` together.

6. Open [http://localhost:3001](http://localhost:3001)

## Logging in

The dashboard uses NextAuth with GitHub, Google, SSO and a Resend magic-link provider.

In `NODE_ENV=development`, `src/lib/auth/providers.ts` **prints the magic link to the dashboard's terminal stdout** instead of emailing it; the development profile's dummy `RESEND_API_KEY` is enough and no OAuth credentials are required. Everywhere else the link is emailed through Resend. A self-hosted deployment (`SELF_HOST=true`) whose Resend send fails still tells the user to check their inbox but prints the link to the server log instead, so look there when running without a real key.

To log in:

1. Open [http://localhost:3001/login](http://localhost:3001/login)
2. Enter `ping@openstatus.dev` (the seeded user, bound to workspace 1) in the magic-link form
3. Watch the dashboard terminal — the magic link is logged there. Open it in your browser.

## Troubleshooting

- **Port 8080 already in use** — a leftover libSQL server from step 2. Kill that terminal and re-run the launch command in step 5.
- **Magic link doesn't arrive** — it isn't emailed in dev. Look in the dashboard terminal stdout for `>>> Magic Link: ...`.
- **Reset the dev DB** — stop the libSQL server, delete `openstatus-dev.db` at the repo root, restart libSQL, then repeat step 3.
- **No Turso CLI or Deno on the machine** (a cloud sandbox) — `node scripts/dev-stack.mjs up` does steps 2 to 5 with sqld and deno fetched from npm; `down` stops them. Its database is `.screenshots/stack/openstatus-dev.db`: `up --reseed` resets the fixtures, or delete the directory while the stack is down.

## Related services (optional for dashboard development)

The dashboard's tRPC API runs on its own Next.js edge routes, so basic CRUD works without the other apps. You may also want to run:

- `apps/server` (Hono) — for API-key features and operations that go through the public HTTP API
- `apps/checker` (Go) — actually executes scheduled monitor checks; without it, monitors are listed but never probed
- Tinybird — uptime / latency time-series graphs; without it, those charts stay empty
