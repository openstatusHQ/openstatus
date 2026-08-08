# OpenStatus Dashboard

## Manual Setup

### Requirements

- [Node.js](https://nodejs.org/en/) >= 20.0.0 — runtime
- [pnpm](https://pnpm.io/) >= 8 — monorepo package manager (see root `package.json` for pinned version)
- [Deno](https://deno.com/) — runs the db env/migrate/seed scripts in `packages/db`
- [Bun](https://bun.sh/) — optional, used by the utility scripts in `src/scripts`
- [Turso CLI](https://docs.turso.tech/quickstart) — starts the local libSQL server via `pnpm --filter '@openstatus/db' dev`

### Environment

Two `.env` files are involved:

- `apps/dashboard/.env` — copy manually now (this step)
- `packages/db/.env` — copied automatically by `pnpm dx` in step 3 below

```sh
cp apps/dashboard/.env.example apps/dashboard/.env
```

The defaults in `.env.example` are dummy values that work for local dev — no real API keys needed.
Fill them in before deployment to enable optional functionality (Resend for real magic-link emails, Stripe, Tinybird analytics, Sentry, GitHub/Google OAuth, etc.).
Email/Magic Link login is only available in dev.

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
pnpm -w dx
```

This chains three turbo tasks (`env → migrate → seed`):

- `env` copies `packages/db/.env.example` → `packages/db/.env`
- `migrate` runs Drizzle migrations against the libSQL server
- `seed` inserts a default workspace, user (`ping@openstatus.dev`), monitors, and a status page

4. Stop the terminal from step 2

`pnpm -w dev:dashboard` starts its own libSQL on port `8080` — leaving the step-2 server running causes a port conflict.

5. Start the dashboard from the repo root

```sh
pnpm -w dev:dashboard
```

Turbo runs the dashboard (`apps/dashboard`) and `@openstatus/db` together.

6. Open [http://localhost:3000](http://localhost:3000)

## Logging in

The dashboard uses NextAuth with GitHub, Google, and — in dev mode — a Resend magic-link provider.

In `NODE_ENV=development` or `SELF_HOST=true`, `src/lib/auth/providers.ts` configures the Resend provider with `apiKey: undefined` and overrides `sendVerificationRequest` to **print the magic link to the dashboard's terminal stdout** instead of sending an email. No OAuth credentials required.

To log in:

1. Open [http://localhost:3000/login](http://localhost:3000/login)
2. Enter `ping@openstatus.dev` (the seeded user, bound to workspace 1) in the magic-link form
3. Watch the dashboard terminal — the magic link is logged there. Open it in your browser.

## Troubleshooting

- **Port 8080 already in use** — a leftover libSQL server from step 2. Kill that terminal and re-run `pnpm -w dev:dashboard`.
- **Magic link doesn't arrive** — it isn't emailed in dev. Look in the dashboard terminal stdout for `>>> Magic Link: ...`.
- **Reset the dev DB** — stop the libSQL server, delete `openstatus-dev.db` at the repo root, restart libSQL, re-run `pnpm -w dx`.

## Related services (optional for dashboard development)

The dashboard's tRPC API runs on its own Next.js edge routes, so basic CRUD works without the other apps. You may also want to run:

- `apps/server` (Hono) — for API-key features and operations that go through the public HTTP API
- `apps/checker` (Go) — actually executes scheduled monitor checks; without it, monitors are listed but never probed
- Tinybird — uptime / latency time-series graphs; without it, those charts stay empty
