# Agent.md

This file provides a comprehensive overview of the OpenStatus project, its architecture, and development conventions to be used as instructional context for future interactions.

## Project Overview

OpenStatus is an open-source synthetic monitoring platform. It allows users to monitor their websites and APIs from multiple locations and receive notifications when they are down or slow.

The project is a monorepo managed with pnpm workspaces and Turborepo. It consists of several applications and packages that work together to provide a complete monitoring solution.

### Core Technologies

-   **Frontend:**
    -   Next.js (with Turbopack)
    -   React
    -   Tailwind CSS
    -   shadcn/ui
    -   tRPC
-   **Backend:**
    -   Hono (Node.js framework)
    -   Go
-   **Database:**
    -   Turso (libSQL)
    -   Drizzle ORM
-   **Data Analytics:**
    -   Tinybird
-   **Authentication:**
    -   NextAuth.js
-   **Build System:**
    -   Turborepo

### Architecture

The OpenStatus platform is composed of three main applications:

-   **`apps/dashboard`**: A Next.js application that provides the main user interface for managing monitors, viewing status pages, and configuring notifications.
-   **`apps/server`**: A Hono-based backend server that provides the API for the dashboard application.
-   **`apps/checker`**: A Go application responsible for performing the actual monitoring checks from different locations.

These applications are supported by a collection of shared packages in the `packages/` directory, which provide common functionality such as database access, UI components, and utility functions.

## Building and Running

The project can be run using Docker (recommended) or a manual setup.

### With Docker

1.  Copy the example environment file:
    ```sh
    cp .env.docker.example .env.docker
    ```
2.  Start all services:
    ```sh
    docker compose up -d
    ```
3.  Access the applications:
    -   Dashboard: `http://localhost:3002`
    -   Status Pages: `http://localhost:3003`

### Manual Setup

1.  Install dependencies:
    ```sh
    pnpm install
    ```
2.  Initialize the development environment:
    ```sh
    pnpm dx
    ```
3.  Run a specific application:
    ```sh
    pnpm dev:dashboard
    pnpm dev:status-page
    pnpm dev:web
    ```

### Running Tests

To run the test suite, use the following command:

Before running the test you should launch turso dev in a separate terminal:
```sh
turso dev
```

Then, seed the database with test data:

```sh
cd packages/db
pnpm migrate 
pnpm seed
```

Then run the tests with:

```sh
pnpm test
```

## Development Conventions

-   **Monorepo:** The project is organized as a monorepo using pnpm workspaces. All applications and packages are located in the `apps/` and `packages/` directories, respectively.
-   **Build System:** Turborepo is used to manage the build process. The `turbo.json` file defines the build pipeline and dependencies between tasks.
-   **Linting and Formatting:** The project uses Biome for linting and formatting. The configuration can be found in the `biome.jsonc` file.
-   **Code Generation:** The project uses `drizzle-kit` for database schema migrations.
-   **API:** The backend API is built using Hono and tRPC. The API is documented using OpenAPI.

## Services & Audit Log Pattern

All workspace-scoped business logic lives in `packages/services` — **not** in tRPC routers. Routers stay thin: validate input, call a service verb, map errors. This keeps logic reusable across tRPC, Hono, and background jobs, and keeps it Edge-safe (the dashboard runs tRPC on Next.js Edge, so service code must avoid `node:*` imports).

Conventions for any new mutation:

-   **One file per verb** under `packages/services/src/<entity>/` (e.g. `create.ts`, `update.ts`, `remove.ts`), re-exported from the entity's `index.ts`. Routers import from `@openstatus/services/<entity>`.
-   **Standard signature:** `async function verbEntity(args: { ctx: ServiceContext; input: VerbInput }): Promise<...>`. `ctx` carries `workspace`, `actor`, and an optional `db`/transaction. Parse input with the schema at the top of the function.
-   **Wrap mutations in `withTransaction(ctx, async (tx) => { ... })`** — it reuses an outer tx if present, otherwise opens one. Always pass `tx` (not `defaultDb`) to writes inside the block.
-   **Workspace scoping is mandatory.** Every read/write filters by `ctx.workspace.id`. Use the `getXInWorkspace` helpers in `internal.ts` for fetch-or-throw.
-   **Throw `ServiceError` subclasses** (`NotFoundError`, `ForbiddenError`, etc. from `./errors`). Routers convert them via `toTRPCError`.
-   **Emit an audit row for every mutation** via `emitAudit(tx, ctx, entry)` inside the same transaction. Fail-closed: a failed audit insert rolls back the mutation. See `packages/services/src/audit/emit.ts`.
    -   For updates, pass both `before` (pre-mutation snapshot) and `after` (post-`.returning()` row). `changed_fields` is auto-diffed; no-op updates are skipped.
    -   For creates/deletes, pass only `after` or only `before`.
    -   **Strip secrets** from snapshots before emitting (e.g. `credential`, bot tokens, raw API keys) — see `integration/remove.ts` for the pattern.
    -   Action names follow `{entity}.{verb}` (`monitor.update`, `integration.delete`). Add new variants to the discriminated union in `@openstatus/db/src/schema/audit_logs/validation.ts`.
-   **Tests live in `packages/services/src/<entity>/__tests__/`** and use `expectAuditRow({ workspaceId, action, entityId, ... })` from `packages/services/test/helpers.ts` to assert the audit side-effect. Each suite scopes to its own workspace and clears `audit_log` between cases.

When adding a router endpoint, the default answer is "write the service verb first, then call it from the router." Inline DB access in routers is a smell — it bypasses the audit log and the Edge-safety guarantee.
