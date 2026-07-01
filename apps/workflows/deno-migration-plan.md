# Plan: migrate `apps/server` + `apps/workflows` from bun to Deno 2.9

Goal: remove **bun** from the project. Three pillars, shipped as **one big-bang PR**:

1. **Build** — `bun build --compile` → `deno compile` (server + workflows).
2. **Install** — the Docker `pnpm install` stage → `deno install` (server + workflows).
3. **Tests** — `bun:test` → **`node:test` runner + `@std/expect`**, run via **`deno test`**,
   across **all ~270 test files** (12 packages + apps server, workflows, web, status-page).

The other apps (`web`, `dashboard`, `status-page`, `docs`, `screenshot-service`) keep
**pnpm** for install + their existing builds; their only bun usage was `bun test`, removed by
pillar 3. `pnpm` remains the local-dev + non-migrated-app package manager.

---

## Agreed decisions (the design)

| # | Area | Decision |
|---|------|----------|
| 1 | Test scope | All ~270 `bun:test` files (12 packages + server/workflows/web/status-page) |
| 2 | Rollout | One big-bang PR, guarded by a baseline test-count parity gate (#16) |
| 3 | Entrypoint | **Split**: `index.ts` exports `app`; new `serve.ts` calls `Deno.serve`, is the compile target |
| 4 | Assertions | Keep Jest-style `expect` via **`@std/expect`** |
| 5 | Mocks | **`@std/testing/mock`** (`spy`/`stub`, `using`) + **`@std/testing/time`** (`FakeTime`) |
| 6 | `mock.module` | **Hybrid**: `stub` the reachable seams; **default-param DI** for the rest; delete dead ones |
| 7 | Test infra | New **`@openstatus/test-utils`** package: matchers (`expect.extend`), setup, shared fakes |
| 8 | DI style | **Default-parameter injection** for `dispatch*` / `getChannel` |
| 9 | Snapshots / type tests | `@std/testing/snapshot` / `expect-type` |
| 10 | Typecheck | Replace `tsc` with **`deno check`**, scoped to `apps/server` + `apps/workflows` (src + tests) |
| 11 | Permissions | `-A` for `deno test` and `deno compile` now; tighten the binary in a follow-up |
| 12 | Docker install | `deno install --prod --frozen --allow-scripts`, hoisted node_modules; `pnpm-workspace.yaml` stays authoritative; commit `deno.lock` only |
| 13 | CI install | CI test/migrate jobs **keep `pnpm install`**; `deno install` is exercised by the docker-publish build |
| 14 | CI test orchestration | Keep **turbo**; each package `"test": "deno test -A"`; swap `setup-bun` → `setup-deno` |
| 15 | Integration tests | Stay in the same `deno test -A` run, against the CI libsql service (as today) |
| 16 | Safety net | Record base-commit `bun test` pass count; assert `deno test` count ≥ it (fail CI on drop) |
| 17 | Other apps | Stay on pnpm install + existing build |
| 18 | Codemod | `ts-morph`/`jscodeshift` for the mechanical rewrite; hand-fix the ~60-file residue |

---

## Resolved by codebase exploration (facts, not assumptions)

- **Entrypoint must split** — tests do `import { app } from "@/index"`; a top-level
  `Deno.serve` in `index.ts` would boot a server on every test import.
- **Server needs no libsql side-car** — `packages/db` uses `drizzle-orm/libsql/http` (pure
  HTTP). Only `apps/workflows/src/lib/db.ts` uses the native `@libsql/client` embedded replica
  → native-addon compile risk is **workflows-only**.
- **Tests are integration tests against a real libSQL DB** — CI runs a `libsql-server`
  service + migrate + seed. The preload mocks only Tinybird/Redis/subscriptions; DB is real.
- **Step D seams are mixed**: `@/libs/clients` (`tb`/`redis` singletons) + `Redis.fromEnv`
  are stub-able; `@openstatus/subscriptions` `dispatch*` + `getChannel` are destructured live
  bindings called directly → need DI.
- **`node-fetch` mock is dead** — the SUT uses **global `fetch`**; tests set
  `global.fetch = mockFetch` (the effective line) plus a redundant `mock.module("node-fetch")`
  (not a dependency). → `stub(globalThis, "fetch", …)` and delete the `mock.module` line.
- **`start.sh` is unused by Fly** (entrypoint is the binary; compose `command` commented) —
  prod migrations run via CI `migrate.yml`. We keep `start.sh` anyway and port its command.
- **migrate/seed have no `Bun.*`** — `packages/db/src/migrate.mts` + `seed.mts` use only
  `@libsql/client`/drizzle/`process` → run under `deno run -A` unchanged.
- **`Bun.*` lives only in dev/build scripts** — `packages/db/env.ts`, `apps/server/env.ts`,
  `apps/workflows/src/build-docker.ts` (`Bun.file`/`Bun.write`).
- **web/status-page tests are pure logic/util** — no DOM/`@testing-library`/React rendering;
  run under `deno test` with no jsdom.
- **Only `apps/server` runs `tsc`** today (`tsc --noEmit`, `types: ["bun-types"]`).

---

## Phase 0 — Spikes (gate the big-bang) — ✅ DONE (1,2) / deferred (3,4)

Toolchain confirmed: **deno 2.9.0**, bun 1.3.11, pnpm 11.2.1, node 24, dofigen 2.8.0.

1. ✅ **`Deno.serve` + Hono compile/serve.** Compiled, served, `/ping`→200, embedded asset
   read via `Deno.readTextFile(new URL(...))`. **Correction: the flag is `--include`, not
   `--include-as-is`** (the latter does not exist in 2.9).
2. ✅ **libSQL native addon under `deno compile` — make-or-break, PASSED with a bonus.**
   `deno compile` **embeds the native addon into the binary** (10.7MB) and the binary runs from
   a clean dir with **no node_modules**. **Consequence: the workflows `docker` + `libsql`
   side-car stages are no longer needed** (they existed only because `bun build --compile`
   could not embed native addons). One caveat for the real monorepo build: `--node-modules-dir=manual`
   against the giant shared `node_modules` hangs (tries to embed everything) — use deno's
   managed npm resolution / `--exclude-unused-npm` so only reachable packages embed. Final flag
   combo to be settled in Phase 5 against the real Docker build.
3. ⏳ **Test stack interop** — validated at the start of Phase 2 by migrating one real route
   test (faster than a synthetic spike): `@std/expect` matchers, `toHaveBeenCalled*` vs
   `@std/testing/mock` spies (else `assertSpyCalls`), `expect.extend`, `stub` on `tb` getters +
   `globalThis.fetch`, `FakeTime`.
4. ⏳ **`deno install` on the repo** — done carefully in Phase 3 (it may rewrite manifests and
   re-layout `node_modules`, which would disrupt the in-progress pnpm-based work), in an
   isolated copy first.

---

## ✅ RESOLVED — deep workspace imports: exports maps + sloppy (no deno.json)

**Solution (verified under `deno run` + `deno compile` + bun):** add an `exports` map to the
4 deep-imported packages (`@openstatus/db`, `@openstatus/api`, `@openstatus/emails`,
`@openstatus/tracker`) and pass `--unstable-sloppy-imports` on every deno command. The exports
map crosses the package boundary (sloppy can't); sloppy resolves the relative extensionless
imports inside packages. **No deno.json. 4 package.json touched, not 512 imports.**

Exports map shape (per package), covering the 36 distinct targets (29 files, 7 dirs all in db):

```jsonc
"exports": {
  ".": "./src/index.ts",
  "./env.mjs": "./env.mjs",                      // db only (non-src deep import)
  "./src/schema": "./src/schema/index.ts",       // + the 6 other directory targets
  "./src/client": "./src/client.tsx",            // .tsx files need explicit entries
  "./src/*": "./src/*.ts"                         // wildcard handles the .ts files
}
```

Every deno invocation (`test`/`compile`/`check`/`run`) must include `--unstable-sloppy-imports`.

### Original investigation (kept for context)

The codebase has **512 bare deep-subpath imports across 400 files** of the form
`@openstatus/db/src/schema/constants` (also `@openstatus/api/src/*`, `@openstatus/emails/src/*`,
`@openstatus/tracker/src/*`). Targets are a **mix of `.ts` files, `.tsx` files, and directories**
(`@openstatus/db/src/schema` is a dir with `index.ts`). Verified facts (Deno 2.9.0 experiments):

- **`--unstable-sloppy-imports` resolves *relative* extensionless imports** (incl. dir-index and
  `.tsx`) for `deno run`/`compile`/`test`. ✅
- It does **NOT** resolve **bare cross-package** deep subpaths — those go through node_modules
  package resolution where sloppy does not apply. Fails for run/compile/test (works only for the
  lenient `deno check` TS resolver). ❌ — true even in Deno workspace mode (`deno install`).
- **Explicit extension** (`@openstatus/db/src/schema/constants.ts`) resolves under both Deno and
  bun — but directory imports still need `/index.ts`, and it risks the Next.js apps (turbopack/tsc).
- **`exports` map** with a `./src/*` wildcard handles `.ts` files but **not** the mixed
  dir/`.tsx` cases reliably (Deno does not fall through exports fallback arrays on a missing file).
- **deno.json import map** prefix (`"@openstatus/db/src/": "./packages/db/src/"`) + sloppy
  **resolves ALL cases** (file `.ts`/`.tsx` + dir-index) for run **and** compile. ✅ — but it is a
  `deno.json`, which the user asked to avoid.

**This is a hard fork:** the only clean, complete fix is a 4-entry `deno.json` import map, which
collides with the "no deno.json" preference ([[feedback-no-deno-json]]). Awaiting a decision (see
chat) before proceeding with Phase 2+. Everything below assumes that decision is made.

## Implementation findings (verified during execution)

- **`@/*` tsconfig path alias** — Deno doesn't read tsconfig `paths`. 153 `@/…` imports across
  113 files in `apps/server` rewritten to **relative paths** (codemod). workflows uses none. ✅
- **`deno install` foundation** — works, with one workaround: it **crashes seeding `deno.lock`
  from `pnpm-lock.yaml`** on a pnpm alias (`string-width-cjs@string-width@4.2.3`). Fix: move
  `pnpm-lock.yaml` aside during `deno install` so Deno resolves fresh, then restore it. Deno
  migrates the **catalog into root `package.json`** (not deno.json) and writes `deno.lock`.
  After install, the full server graph resolves (deep imports + `zod` + `hono`). ✅
- **`@std/expect` `toHaveBeenCalled*` does NOT accept `@std/testing/mock` spies** (verified:
  "Received function must be a mock or spy function"). → the ~187 `toHaveBeenCalled*` sites must
  use **`assertSpyCalls`/`assertSpyCall`** instead. Basic `expect`, `expect.extend` custom
  matchers, and `FakeTime` all work. ⚠ (more test rework than planned)
- **✅ `deno compile` of `apps/server` WORKS in a clean Docker container** — the local 12-min
  hang was the **polluted local node_modules** (Deno-managed mix + broken `.next` symlinks +
  every app's deps). In Docker with a **scoped `pnpm install --filter @openstatus/server...`**
  (20.8s) then `deno compile --node-modules-dir=manual`, the binary builds fast and **runs**:
  `/ping`→200, `/openapi.yaml`→embedded asset, full app graph boots ("Listening on :3000").
  - **Winning build recipe** (`apps/server/Dockerfile.deno-test`): node:24-slim → `pnpm install
    --prod --frozen-lockfile --filter @openstatus/server...` → denoland/deno:2.9.0 → `deno
    compile -A --no-check --unstable-sloppy-imports --node-modules-dir=manual --include
    static/openapi.yaml --include static/openapi-v1.json --output app src/serve.ts` → debian
    runtime with just the binary.
  - **No `deno install`** in the build — pnpm install (scoped) is what produces node_modules;
    Deno reads the catalog from root `package.json` (migrated once) + consumes pnpm's layout.
    This sidesteps `deno install`'s whole-monorepo install + the pnpm-alias lockfile crash.
  - Catalog must be present in root `package.json` for Deno to resolve `catalog:` specifiers.
  - Sandbox note: needed `docker build --network=host` here (flaky build-network); normal CI ok.
  - Image 495MB (debian + binary). Could slim further later.
- **✅ `apps/workflows` also builds in Docker** (same recipe, `--filter @openstatus/workflows...`,
  465MB) and **embeds the libSQL native addon** (no side-car). Verified the binary executes (it
  reaches the embedded-replica `createClient` and opens the sync connection). Full boot needs a
  real Turso `DATABASE_URL` — in the sandbox it blocks in SYN_SENT to an unreachable sync URL at
  module load (the `createClient` runs before logging, so no logs appear). Not a build defect.
- **⚠ `@sentry/bun` → `@sentry/deno`** — workflows used `@sentry/bun` (bun-only; hangs under
  Deno) in `index.ts`, `lib/sentry.ts`, `cron/index.ts`. Swapped all three to `@sentry/deno`
  (`10.61.0`, API-compatible: `init`/`captureException`/`captureMessage`/`captureCheckIn`/`flush`),
  updated `package.json` + `pnpm-lock.yaml`. The server uses `@hono/sentry` (unaffected).
- **⚠ embedded-replica `createClient` blocks at module load** until the sync URL connects — so
  the workflows process won't serve `/ping` until the DB is reachable. Pre-existing behavior
  (bun did the same); flagged for prod startup robustness.

## Phase 2 — Test migration — 🔶 IN PROGRESS

- ✅ `@openstatus/test-utils` package built + validated: re-exports `node:test` runner with a
  Bun-compat **`.each`** shim, `@std/expect` `expect` extended with the ~12 **bun-only matchers**
  (`toBeNumber`, `toContainValue`, …), and `@std/testing/mock` (`spy`/`stub`/`assertSpyCalls`) +
  `@std/testing/time` (`FakeTime`). Uses `jsr:@std/*` so only Deno needs them.
- ✅ Codemod swapped `bun:test` → `@openstatus/test-utils` in **194 files**; updated 21+
  `package.json` (`deno test` script, test-utils devDep, dropped `@types/bun`/`bun-types`);
  removed `bunfig.toml`.
- ✅ **`@/*` alias → relative** rewrite: server (153), status-page (211), web (332). Deno
  ignores tsconfig paths.
- ✅ **Import-only suites PASS under `deno test`**: header-analysis (7), status-page (51), web
  (23). Mock pattern validated: discord + 5 more notifications PASS.
- 🔶 **Remaining mock work (~47 files)**: `@std/expect` `toHaveBeenCalled*` does NOT accept std
  spies → use `assertSpyCalls`. Per-file quirks remain: 6 notifications (webhook double-stub,
  bird-whatsapp `jest`, slack/grafana call-count-after-restub), importers clients, status-fetcher,
  tracker (`FakeTime`), subscriptions/api/server (**`mock.module` → stub + default-param DI**,
  and these are **DB-integration tests needing a running libSQL to verify**).
- ⏳ snapshots (`toMatchSnapshot` → `@std/testing/snapshot`) + type tests (`expectTypeOf` →
  `expect-type`) not started.

## Phase 1 — Source changes — ✅ DONE

- ✅ split `index.ts`/`serve.ts` (both apps); server static asset → `Deno.readTextFile`.
- ✅ `Bun.*` → `Deno.copyFile` in `apps/server/env.ts`, `packages/db/env.ts`.
- ✅ `migrate`/`seed`/`env` scripts + `start.sh` → `deno run -A`; app `dev`/`start`/`test` → deno.

(Detail of the changes below.)

### Entrypoint split (both apps)

`index.ts`: keep `export const app = new Hono(...)`, **remove** `const server = {...}` +
`export default server`. New `serve.ts`:

```ts
import { app } from "./index";
import { env } from "./env";
Deno.serve({ port: env.PORT ?? 3000 }, app.fetch);
```

`serve.ts` is the `deno compile` target. Tests still import `app` with no server side-effect.

### Server static asset (`apps/server/src/index.ts:22`)

Drop `import openapiYaml … with { type: "text" }`. Embed via `--include-as-is` (Phase 4) and
read at startup:

```ts
const openapiYaml = await Deno.readTextFile(new URL("../static/openapi.yaml", import.meta.url));
```

JSON imports (`with { type: "json" }`) stay — Deno supports them.

### `Bun.*` → Deno APIs (dev/build scripts)

`packages/db/env.ts`, `apps/server/env.ts`: `Bun.file(p).text()/.json()` →
`Deno.readTextFile(p)` (+ `JSON.parse`); `Bun.write(p, s)` → `Deno.writeTextFile(p, s)`.
(`apps/workflows/src/build-docker.ts` is deleted in Phase 5 — no port needed.)

### migrate / `start.sh`

`packages/db/package.json`: `"migrate": "deno run -A src/migrate.mts"`,
`"seed": "deno run -A src/seed.mts"`, `"env": "deno run -A env.ts"`. Keep `start.sh`; change
`bun src/migrate.mts` → `deno run -A src/migrate.mts`.

---

## Phase 2 — Test migration (`bun:test` → `node:test` + `@std/expect`, `deno test`)

Surface: **~270 files**, ~2920 `expect` assertions, ~150 bun-only matchers, 47 `mock` /
21 `spyOn` / 10 `setSystemTime` / 6 `jest.*`, 4 `mock.module` seams (+ dead `node-fetch`),
12 snapshot files, 10 type-test files.

### Step 0 — `@openstatus/test-utils` package (Decision 7)

```
packages/test-utils/
  src/setup.ts     # registers expect.extend matchers; installs the global fetch stub helper
  src/matchers.ts  # the ~150 bun-only matchers (toBeNumber, toContainValue, toBeString, …)
  src/fakes/       # tinybird.ts, redis.ts, subscriptions.ts — shared test doubles
```

Each tester adds `@openstatus/test-utils` as a devDependency; every test file imports
`@openstatus/test-utils/setup` **first** (codemod injects).

### Step A — codemod (`ts-morph`/`jscodeshift`, ~270 files)

Per file: replace the `bun:test` import with `node:test` + `@std/expect`, alias
`beforeAll→before`/`afterAll→after`, and inject `import "@openstatus/test-utils/setup";` as
the first import. `expect(...)` bodies untouched.

### Step B — bun-only matchers

Implemented once in `@openstatus/test-utils` via `expect.extend` (verified in Phase 0 spike 3).
`pass()`/`fail()` helpers → explicit `expect(...)` assertions in the few sites that use them.

### Step C — mocks (`@std/testing/mock` + `@std/testing/time`)

`mock(fn)`→`spy(fn)`; `spyOn(o,"m")`→`using s = spy(o,"m")` / `stub(o,"m",impl)`; sequential
returns→`returnsNext`; `setSystemTime`→`using t = new FakeTime(date)` + `t.tick`. Prefer
`using` (auto-restore) — deletes most `afterEach` teardown. Keep `toHaveBeenCalled*` if Phase-0
interop holds, else `assertSpyCalls`/`assertSpyCall`.

### Step D — module mocks (hybrid; Decisions 6 + 8)

- **stub-able** → `@std/testing/mock` `stub`, fakes from `@openstatus/test-utils/fakes`:
  `tb`/`redis` (`@/libs/clients` singletons), `Redis.fromEnv` (`@openstatus/upstash`).
- **global fetch** → `stub(globalThis, "fetch", …)`; **delete** every `mock.module("node-fetch")`.
- **DI (default-param)** → `dispatchMaintenanceUpdate`, `dispatchStatusReportUpdate`
  (`maintenances/post.ts`, `statusReports/post.ts`), `getChannel`
  (`rpc/handlers/status-page/index.ts`): add `deps = { … }` last param; tests pass fakes.
- The old global `preload.ts` is deleted; its four mocks move to the above mechanisms.

### Step E — preload replacement

`bunfig.toml` preload is gone; the `@openstatus/test-utils/setup` import (Step A) replaces it.
Import ordering: setup first, then the SUT.

### Step F — snapshots + type tests

Snapshots → `@std/testing/snapshot` `assertSnapshot(t, value)` (regenerate + diff the 12
files). Type tests → `expect-type` (`expectTypeOf<T>().toEqualTypeOf<U>()`), validated by
`deno check` where in scope (the two apps).

### Step G — invocation

Each package/app `"test": "deno test -A"`. Pull `@std/expect`, `@std/testing`, `expect-type`
via `jsr add`/devDeps so pnpm install resolves them. Remove `bunfig.toml`, `bun-types`,
`@types/bun`.

---

## Phase 3 — Install via `deno install` (Docker, server + workflows)

Deno 2.9 reads `pnpm-workspace.yaml` catalogs (482 `catalog:` refs) + workspace globs
(244 `workspace:*`) and seeds `deno.lock` from `pnpm-lock.yaml`. dofigen `install` stage:

```yaml
  install:
    fromImage: denoland/deno:2.9.0
    workdir: /app/
    env:
      DENO_NODE_MODULES_DIR: auto      # hoisted layout for compile + libsql side-car
    bind:
      - pnpm-workspace.yaml            # catalog + workspace source of truth
      - pnpm-lock.yaml
      - deno.lock
      - package.json
      - …all workspace package.json (same bind list as today)…
    run: deno install --prod --frozen --allow-scripts
    cache:
      - /deno-dir
```

`pnpm-workspace.yaml` stays authoritative (Decision 12); commit `deno.lock`; do **not** commit
any catalog/`deno.json` that 2.9 may emit. Verify (Phase 0 spike 4) the migration write stays
additive so pnpm keeps working for the other apps.

---

## Phase 4 — `apps/server/dofigen.yml` (build)

`build` stage → Deno + `deno compile` (target `serve.ts`). No libsql side-car (HTTP driver).

```yaml
  build:
    fromImage: denoland/deno:2.9.0
    workdir: /app/apps/server
    env: { NODE_ENV: production }
    copy:
      - . /app/
      - { fromBuilder: install, source: /app/node_modules, target: /app/node_modules }
      - { fromBuilder: install, source: /app/apps/server/node_modules, target: /app/apps/server/node_modules }
      - { fromBuilder: install, source: /app/packages, target: /app/packages }
    run: >-
      deno compile -A --no-check --node-modules-dir
      --include static/openapi.yaml --include static/openapi-v1.json
      --output app serve.ts
```

`--no-check` keeps compile fast (`deno check` is the typecheck gate, Decision 10). Optionally
benchmark experimental `--bundle` for a smaller binary. Runtime copy `/app/apps/server/app` →
`/bin/app` unchanged.

---

## Phase 5 — `apps/workflows/dofigen.yml` (build) — side-car DROPPED

Spike 2 proved `deno compile` **embeds** the libSQL native addon into the binary, so the whole
side-car apparatus goes away:

1. **`build`** → `deno compile -A --no-check --output app serve.ts`. Settle the npm-embed flags
   here (`--exclude-unused-npm` / managed npm) so it embeds reachable packages, not the whole
   `node_modules` (spike 2 caveat).
2. **DELETE the `docker` stage** (`build-docker.ts` existed only to generate the side-car
   `package.json`) and **DELETE the `libsql` stage**.
3. **`build-docker.ts`** itself becomes dead code → remove (its sole purpose was the side-car).
4. **runtime copy** → just the self-contained `app` binary. No `node_modules` copied at all.

This makes the workflows runtime image dramatically simpler (binary only, like server).

---

## Phase 6 — CI

- `test.yml` + `migrate.yml`: replace `oven-sh/setup-bun` with `denoland/setup-deno@v2`
  (Deno 2.9). **Keep `pnpm install`** (Decision 13), the libsql service, migrate, seed.
  `pnpm test` → turbo → per-package `deno test -A` (Decision 14).
- Add a **`deno check`** step for `apps/server` + `apps/workflows` (src + tests) replacing the
  server `tsc` step (Decision 10).
- **Parity gate** (Decision 16): a CI step records the base-commit `bun test` total pass count
  (artifact / committed baseline number), then asserts `deno test`'s pass count ≥ baseline.
- docker-publish workflows exercise `deno install` + `deno compile` via the Dockerfiles.

---

## Phase 7 — Verify & ship

Per app: `dofigen generate`; `docker buildx build -f apps/<app>/Dockerfile .` from repo root;
run, `GET /ping` → 200; server `GET /openapi.yaml` → body; workflows embedded replica syncs +
a cron endpoint responds. Locally: `pnpm install && pnpm migrate && pnpm seed && pnpm test`
green; parity count ≥ baseline; `deno check` clean for the two apps. Watch Fly RSS/OOM on
workflows after deploy (Deno V8 heap defaults differ from bun — see `research.md`).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| ~~libSQL native addon won't `deno compile`~~ | ✅ RESOLVED (spike 2): deno embeds the addon; side-car dropped |
| Big-bang PR hides a regression / silent skip | Parity gate (16); split into logical commits within the one PR for bisect |
| `@std/expect` `toHaveBeenCalled*` ✗ interop with `@std/testing/mock` spies | Phase-0 spike 3; fallback `assertSpyCalls`/`assertSpyCall` |
| `deno install` rewrites manifests / breaks pnpm for other apps | Phase-0 spike 4; keep `pnpm-workspace.yaml` authoritative, don't commit deno catalog |
| `deno check` surfaces new diagnostics vs `tsc` | Scoped to two apps (10); fix as part of the PR |
| ~270-file codemod churn | AST codemod (18) + parity gate; hand-fix the ~60-file residue |
| `stub` can't reach `tb` getter methods | Phase-0 spike 3; fallback = make `tb`/`redis` injectable like the dispatch seams |

---

## TODO

- [ ] **Phase 0** spikes: serve+compile · libsql-compile (workflows) · test-stack interop · `deno install`
- [ ] Phase 1: split `index.ts`/`serve.ts` (both) · server static asset · `Bun.*`→Deno · migrate/seed/`start.sh`→deno
- [ ] Phase 2.0: create `@openstatus/test-utils` (matchers, setup, fakes)
- [ ] Phase 2.A: codemod imports + lifecycle + setup-inject (~270 files)
- [ ] Phase 2.B–C: matchers via `expect.extend`; mocks → `@std/testing/mock`/`time`
- [ ] Phase 2.D: hybrid module mocks — stub `tb`/`redis`/`Redis.fromEnv` + `globalThis.fetch`; DI `dispatch*`/`getChannel`; delete `node-fetch` mocks + `preload.ts`
- [ ] Phase 2.F: snapshots → `@std/testing/snapshot`; type tests → `expect-type`
- [ ] Phase 2.G: `"test": "deno test -A"` everywhere; add JSR devDeps; remove `bunfig.toml`/`bun-types`
- [ ] Phase 3: `deno install` stage (both dofigen); commit `deno.lock`
- [ ] Phase 4: `apps/server` build → `deno compile` (serve.ts, `--include-as-is`)
- [ ] Phase 5: `apps/workflows` build → `deno compile`; `build-docker.ts`→deno; `libsql` stage→npm
- [ ] Phase 6: CI `setup-deno`, keep `pnpm install`, `deno check` (2 apps), parity gate
- [ ] Phase 7: `dofigen generate` + docker build + verify each app; ship; watch Fly RSS
- [ ] Update CLAUDE.md memory note "use bun test directly" → `deno test`
</content>
