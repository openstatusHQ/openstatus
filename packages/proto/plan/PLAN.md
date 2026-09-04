# Plan: `GetPageComponent` — resolve a page component by ID

## Motivation

Customer (Philipp Honsel, netgo) is on the **new `/rpc` Connect API** (C#
backend, plain HTTP + JSON, no SDK). Their concrete pain:

> **API Gap — Component Name Resolution.** They fetch the *entire* status-page
> content **daily** just to build a component-`id` → `name` map, because there
> is no way to resolve a single component by id. Confirmed as a gap.

Today the only read path for a `PageComponent` is
`StatusPageService/GetStatusPageContent`, digging the component out of the
`.components` array. Add a direct single-component read.

The customer imagines a RESTful `GET /status-page-component/{id}`; the actual
call on this API is a Connect unary POST (they already call
`.../GetStatusPageContent` the same way):

```
POST https://api.openstatus.dev/rpc/openstatus.status_page.v1.StatusPageService/GetPageComponent
x-openstatus-key: <key>
content-type: application/json

{ "id": "1777074467622" }
```

Response — the existing `PageComponent` shape (includes `name`, which is what
they need, plus everything else):

```json
{
  "component": {
    "id": "1777074467622",
    "pageId": "5076",
    "name": "system",
    "type": "PAGE_COMPONENT_TYPE_MONITOR",
    "monitorId": "10360",
    "order": 0,
    "groupId": "",
    "groupOrder": 0,
    "description": "",
    "createdAt": "2026-06-29T11:35:21.000Z",
    "updatedAt": "2026-07-01T09:36:06.000Z"
  }
}
```

## Decisions (settled)

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Access model** | Auth-only, workspace-scoped, request is `{ id }`. Cross-workspace id → 404. No public slug path. | Matches `GetStatusPage`/`GetMonitor`; customer calls with an API key. |
| **Response** | Bare `PageComponent`, existing message untouched. No `page_component.proto` edit. | Already carries `name` + everything; smallest change. |
| **RPC name** | `GetPageComponent` (not `GetPageComponentById`). | House convention: `GetMonitor`, `GetStatusPage`, `GetMaintenance`, `GetNotification`, `GetStatusReport` — none use a `ById` suffix. Tell the customer the final path. |
| **Implementation** | Inline handler, reuse existing `getComponentById` + `dbComponentToProto` + `pageComponentNotFoundError`. No new service files. | This handler already reads components inline (e.g. `updateComponent`). Read → no audit, no `requireScope`. |
| **Malformed id** | Non-numeric → `NaN` → lookup miss → **404** (fall-through). Empty string → **400** from the `min_len=1` validator. | Identical to every sibling `Get*`; no bespoke validation branch. |
| **Tests** | Full 5-case mirror of the `GetStatusPage` block. | Consistency; reuses existing seed + `connectRequest` helper. |
| **Transports** | Connect/REST `/rpc` API only. No MCP tool, no tRPC procedure. | Customer need is API-only; MCP already has `listPageComponentsTool`; dashboard reads via its own tRPC. |

Non-breaking: additive RPC + messages, passes buf `FILE` breaking rule.

---

## 1. Proto — `api/openstatus/status_page/v1/service.proto`

No new message *types* (`PageComponent` in `page_component.proto` is reused).

Add the RPC in the **Component Management** block of `StatusPageService`, after
`UpdateComponent`:

```protobuf
// GetPageComponent retrieves a single component by ID.
rpc GetPageComponent(GetPageComponentRequest) returns (GetPageComponentResponse) {
  option idempotency_level = NO_SIDE_EFFECTS;
  option (gnostic.openapi.v3.operation) = {
    description: "Returns a single status-page component by its ID, scoped to the authenticated workspace. Use this to resolve a component id to its name (and other fields) instead of fetching the whole page via GetStatusPageContent and filtering .components."
  };
}
```

Add the messages in the **Component Management Messages** section:

```protobuf
// GetPageComponentRequest is the request to fetch a single component by ID.
message GetPageComponentRequest {
  // ID of the component to retrieve (required).
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

// GetPageComponentResponse is the response containing the component.
message GetPageComponentResponse {
  // The requested component.
  PageComponent component = 1;
}
```

## 2. Regenerate + sync OpenAPI

From `packages/proto`:

```sh
pnpm buf:lint      # STANDARD lint must pass
pnpm buf:ts        # regenerate gen/ts (server consumes this)
pnpm buf:openapi   # refresh gen/openapi.yaml (NO_SIDE_EFFECTS → allow-get)
```

Then the **required manual sync** (server serves the static copy via Scalar at
`/openapi`; there is no automated copy script — `static/openapi.yaml` was last
updated by hand alongside the `GetStatusPageOverview` PR #2308):

```sh
cp packages/proto/gen/openapi.yaml apps/server/static/openapi.yaml
```

Commit the regenerated `gen/ts/**`, `gen/openapi.yaml`, and the updated
`apps/server/static/openapi.yaml` together.

## 3. Handler — `apps/server/src/routes/rpc/handlers/status-page/index.ts`

All dependencies already exist in this file: `getComponentById(id, workspaceId)`
(~line 277), `dbComponentToProto` (imported), `pageComponentNotFoundError`
(imported, resolves to `Code.NotFound` → HTTP 404).

Add to `statusPageServiceImpl`, in the Component Management block:

```ts
async getPageComponent(req, ctx) {
  try {
    const rpcCtx = getRpcContext(ctx);
    const id = req.id?.trim();
    if (!id) throw pageComponentNotFoundError(req.id);

    const component = await getComponentById(Number(id), rpcCtx.workspace.id);
    if (!component) throw pageComponentNotFoundError(id);

    return { component: dbComponentToProto(component) };
  } catch (err) {
    toConnectError(err);
  }
},
```

`getComponentById` filters by `workspaceId`, so a foreign-workspace id returns
404 with no info leak. The generated `ServiceImpl<typeof StatusPageService>`
type now *requires* this method — a missing impl fails the build.

## 4. Tests — `apps/server/src/routes/rpc/handlers/status-page/__tests__/status-page.test.ts`

New `describe("StatusPageService.GetPageComponent")` block mirroring
`GetStatusPage`, using the existing `connectRequest(method, body, headers)`
helper and the already-seeded `${TEST_PREFIX}-component` (workspace 1):

| Test | Input | Assert |
|------|-------|--------|
| returns component by ID | `{ id: <seeded component id> }`, key `"1"` | 200; body `component.name`/`id`/`pageId`/`type`/`monitorId` correct |
| 401 when no auth key | `{ id: ... }`, no key | 401 |
| 404 for non-existent component | `{ id: "99999" }`, key `"1"` | 404 |
| error when ID is empty | `{ id: "" }`, key `"1"` | 400 (min_len validator) |
| 404 for component in different workspace | insert component in workspace 2, key `"1"` | 404 (cleanup in `finally`) |

## 5. Verification

1. `pnpm buf:lint && pnpm buf:ts && pnpm buf:openapi` + the `cp` sync.
2. Typecheck `apps/server` (the `ServiceImpl` type enforces the new method).
3. Run the status-page RPC test suite (5 new cases green).
4. Manual smoke:
   ```sh
   curl -X POST https://<host>/rpc/openstatus.status_page.v1.StatusPageService/GetPageComponent \
     -H "x-openstatus-key: <key>" -H "content-type: application/json" \
     -d '{"id":"<componentId>"}'
   ```
5. Reply to the customer with the exact POST call above (their `GET /path/{id}`
   idea maps to this `/rpc` POST they already use for `GetStatusPageContent`).

## Files touched

| File | Change |
|------|--------|
| `packages/proto/api/openstatus/status_page/v1/service.proto` | +1 RPC, +2 messages |
| `packages/proto/gen/ts/**`, `packages/proto/gen/openapi.yaml` | regenerated |
| `apps/server/static/openapi.yaml` | synced copy of `gen/openapi.yaml` |
| `apps/server/src/routes/rpc/handlers/status-page/index.ts` | +1 handler method |
| `apps/server/src/routes/rpc/handlers/status-page/__tests__/status-page.test.ts` | +1 describe block, 5 tests |

## Explicitly out of scope

- No `page_component.proto` / message changes (bare component is enough).
- No enrichment (monitor status, group name, computed status).
- No new service verb (inline handler reuse).
- No MCP tool, no tRPC procedure, no legacy v1 REST alias.
- No public slug access path.

---

## Implementation Checklist

Ordered by phase. Each phase gates the next (proto must lint before codegen;
codegen must land before the handler typechecks). Checkboxes are individual,
verifiable tasks.

### Phase 0 — Pre-flight

- [x] Confirm working dir clean except the expected `M PLAN.md` (jj `@`).
- [x] Confirm `buf` runnable: `packages/proto/node_modules/.bin/buf --version` (≥1.63). *(1.69.0)*
- [x] Re-read the target files before editing so edits apply cleanly:
  - [x] `packages/proto/api/openstatus/status_page/v1/service.proto`
  - [x] `apps/server/src/routes/rpc/handlers/status-page/index.ts`
  - [x] `apps/server/src/routes/rpc/handlers/status-page/__tests__/status-page.test.ts`
- [x] Note the seeded fixture name/id used by the test suite (`${TEST_PREFIX}-component`, workspace 1) for the success-case assertion. *(static component, order 100)*

### Phase 1 — Proto definition

- [x] In `service.proto`, add the `GetPageComponent` RPC inside the **Component Management** block of `StatusPageService`, right after `UpdateComponent`.
  - [x] Set `option idempotency_level = NO_SIDE_EFFECTS;`.
  - [x] Add the `(gnostic.openapi.v3.operation)` description (id→name resolution wording).
- [x] In the **Component Management Messages** section, add `GetPageComponentRequest` with `string id = 1 [(buf.validate.field).string.min_len = 1];`.
- [x] Add `GetPageComponentResponse` with `PageComponent component = 1;`.
- [x] Confirm no new imports needed (`PageComponent`, `buf/validate`, gnostic annotations already imported by this file).
- [x] Do **not** touch `page_component.proto` (bare message reused).

### Phase 2 — Codegen + OpenAPI sync

- [x] `cd packages/proto && pnpm buf:lint` → status_page path clean (exit 0). *(pre-existing camelCase violations remain in the untouched `internal/private_location` module — not introduced here.)*
- [x] `pnpm buf:ts` → regenerates `gen/ts/**`.
  - [x] Verify `GetPageComponentRequest` / `GetPageComponentResponse` appear in `gen/ts/openstatus/status_page/v1/service_pb.ts`.
  - [x] Verify `GetPageComponent` is added to the `StatusPageService` definition.
- [x] `pnpm buf:openapi` → regenerates `gen/openapi.yaml`.
  - [x] Verify the new operation is present and, given `NO_SIDE_EFFECTS`, is GET-allowed (`allow-get`).
- [x] `cp packages/proto/gen/openapi.yaml apps/server/static/openapi.yaml` (required manual sync).
- [x] `diff -q packages/proto/gen/openapi.yaml apps/server/static/openapi.yaml` → IDENTICAL.

### Phase 3 — Handler implementation

- [x] In `status-page/index.ts`, add the `getPageComponent` method to `statusPageServiceImpl`, in the Component Management block.
  - [x] `getRpcContext(ctx)` → workspace.
  - [x] `req.id?.trim()`; empty → `pageComponentNotFoundError(req.id)`.
  - [x] `getComponentById(Number(id), rpcCtx.workspace.id)`; miss → `pageComponentNotFoundError(id)`.
  - [x] Return `{ component: dbComponentToProto(component) }`.
  - [x] Wrap in `try/catch` → `toConnectError(err)` (mirror sibling `Get*` handlers).
- [x] Confirm no new imports required (`getComponentById` is a local helper; `dbComponentToProto`, `pageComponentNotFoundError`, `getRpcContext`, `toConnectError` already imported).
- [x] Confirm no service-layer / audit / `requireScope` additions (read-only path).

### Phase 4 — Tests

- [x] Add `describe("StatusPageService.GetPageComponent", …)` to `status-page.test.ts`, near the `GetStatusPage` block.
- [x] Test: **returns component by ID** — fetch seeded `${TEST_PREFIX}-component` (key `"1"`) → 200; assert `component.id`, `name`, `pageId`, `type`, `monitorId`.
- [x] Test: **401 when no auth key** — no `x-openstatus-key` → 401.
- [x] Test: **404 for non-existent component** — `{ id: "99999" }`, key `"1"` → 404.
- [x] Test: **400 when ID is empty** — `{ id: "" }`, key `"1"` → 400 (validator).
- [x] Test: **404 for component in different workspace** — insert a `pageComponent` in workspace 2, query with key `"1"` → 404; clean up in `finally`.
- [x] Mirror the existing block's `connectRequest(method, body, headers)` usage and any `beforeAll`/`afterAll` cleanup conventions (TEST_PREFIX).

### Phase 5 — Verification (non-invasive, no DB writes)

- [x] `cd packages/proto && pnpm buf:lint` clean for `status_page` (re-run after all edits). Also oxfmt `--check` + oxlint clean on both changed TS files.
- [x] Typecheck `apps/server` (`pnpm check`) → passes; the generated `ServiceImpl<typeof StatusPageService>` now *requires* `getPageComponent`, so a missing/mis-typed impl fails here. Test file + `packages/proto` also typecheck.
- [x] Do **not** run `pnpm migrate`/`pnpm seed`/`pnpm test` locally (integration tests run in CI on its ephemeral DB).
- [x] Sanity-review the diff surface matches the "Files touched" table (reverted incidental `deno.lock` churn from `deno check`; no other stray files).

### Phase 6 — Wrap-up

- [x] Leave all edits in the jj working-copy change `@` — no `jj new`/describe/bookmark, no commit, no push.
- [x] Summarize the diff back to the user (files + line counts).
- [x] Draft the customer reply (do not send): the exact
  `POST /rpc/openstatus.status_page.v1.StatusPageService/GetPageComponent`
  call with `{ "id": "…" }`, noting it's the same `/rpc` POST pattern they
  already use for `GetStatusPageContent`, and that the response `component.name`
  resolves the id→name mapping. *(drafted in the final summary)*

### Definition of done

- [x] `service.proto` updated; `gen/ts/**` + `gen/openapi.yaml` + `apps/server/static/openapi.yaml` regenerated and in sync.
- [x] `getPageComponent` handler implemented; server typechecks.
- [x] 5 tests added (running deferred to CI).
- [x] buf lint clean (status_page); nothing committed; PLAN.md retained.
