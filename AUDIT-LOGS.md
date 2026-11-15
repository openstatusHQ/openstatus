# Audit logs

Two unrelated trails share the name. Pick the right one before you touch either:

| Trail | Records | Store | Written by | Read by |
| --- | --- | --- | --- | --- |
| **Workspace audit log** | every create, update, delete on workspace data, by any actor | Turso `audit_log` | `emitAudit` in `packages/services` | Settings > Audit logs, `list_audit_logs` / `get_audit_log` tools |
| **Checker trail** | monitor transitions: `monitor.failed`, `monitor.degraded`, `monitor.recovered`, `incident.created`, `incident.resolved`, `notification.sent` | Tinybird `audit_log__v0` | `checkerAudit.publishAuditLog` in `apps/workflows/src/checker` | monitor overview timeline (`tinybird.auditLog`) |

The rest of this file is the workspace audit log. The checker trail is
best-effort telemetry: its schema lives in `packages/tinybird/src/audit-log/`,
and a failed publish never rolls anything back.

## The contract

A mutation and its audit row commit together or not at all.

- `emitAudit(tx, ctx, entry)` runs inside the mutation's `withTransaction`
  callback, through `tx`. It parses `entry` with `auditEntrySchema`; an
  invalid entry throws and rolls the mutation back. Fail-closed is the point.
- Actor columns come from `ctx.actor`, never from the entry:

  | `actorType` | `actorId` | `actorUserId` |
  | --- | --- | --- |
  | `user` | user id | user id |
  | `apiKey`, `mcp` | key id | key owner, when known |
  | `slack` | Slack user id | mapped user, when linked |
  | `system` | job name | null |
  | `webhook` | external id, else source | null |
  | `subscriber` | subscriber id | null |

- Lint (`openstatus/services-mutation-guards`) fails any services function
  that calls `withTransaction` without `emitAudit` and `requireScope`. When the
  row is written elsewhere (an inner verb, a `*InTx` helper), the inline
  disable names that writer: `// Delegates the audit row to revokeGrantRows.`
  The rule matches call names, not the call graph; the tests are the proof.
- The checker ingest path (`apps/workflows/src/checker/transition.ts`) is the
  one mutation outside services and writes no audit row, by design; see
  `packages/services/AGENTS.md`.

## Shape of an entry

```ts
await emitAudit(tx, ctx, {
  action: "monitor.update",        // `${entityType}.${verb}`
  entityType: "monitor",
  entityId: monitor.id,            // stored as text
  before: existing,                // pre-mutation row
  after: updated,                  // the `.returning()` row
});
```

**Three verbs only: `create`, `update`, `delete`.** Acknowledge, resolve,
revoke, rename, archive and bulk-set collapse into whichever of the three they
structurally are; readers recover intent from `changed_fields`. The `action()`
helper in `validation.ts` rejects any other suffix at compile time.

**Snapshots follow the verb**, enforced by the `AuditEntry` type:

| Verb | `before` | `after` | `changed_fields` |
| --- | --- | --- | --- |
| `create` | forbidden | required | null |
| `update` | required | required | top-level keys that differ, minus `createdAt` / `updatedAt` |
| `delete` | required | forbidden | null |

- An update whose diff is empty and carries no `metadata` is **dropped**:
  no row lands. Re-saving an unchanged form is not an event.
- The diff is shallow. A JSON column (`headers`, `locales`, `configuration`)
  reports as one key; the dashboard diffs deeper. `null` and `undefined` are
  equal. Arrays are order-sensitive, so sort id arrays before snapshotting or a
  reorder reads as a change (`maintenance` sorts `monitorIds` for this reason).
- **`metadata`** holds context the snapshot cannot carry: `clonedFromMonitorId`,
  the parent `statusReportId`, a join-table change on `page_subscriber`. A field
  that lives on the row belongs in `before` / `after`. An update with metadata
  lands even when the row diff is empty, because the change lives off-row.
  `metadata` is only accepted on variants declared with `optionalMetadata`.

## Snapshot hygiene

Snapshots are shown to every workspace member with the plan feature, and to
any agent holding a `read` key. Build them like a public API response:

- **Credentials never enter a snapshot**: API key hashes, OAuth secrets, bot
  tokens, webhook signing secrets. Write a `snapshot<Entity>()` helper that
  picks safe fields (`snapshotIntegration`, the explicit object in
  `api-key/create.ts`) instead of passing the raw row.
- One logical change, one row per entity touched. A bulk verb writes one row
  per entity, and same-millisecond rows are ordered by `id`.

## Entities

Source of truth: `auditActionSchema` in
`packages/db/src/schema/audit_logs/validation.ts`. Generated 2026-11-15; regenerate with
`grep -o 'action("[a-z_]*\.[a-z]*"' packages/db/src/schema/audit_logs/validation.ts`.

| Entity type | Verbs | `entityId` is | Notes |
| --- | --- | --- | --- |
| `monitor` | create, update, delete | monitor id | `metadata.clonedFromMonitorId` on clone |
| `monitor_tag` | create, update, delete | tag id | |
| `monitor_incident` | update, delete | monitor incident id | created by the checker, not a verb |
| `monitor_sla_policy` | create, update, delete | policy id | |
| `monitor_sla_excused_window` | create, delete | window id | |
| `monitor_maintenance_window` | create, update, delete | window id | |
| `private_location` | create, update, delete | location id | |
| `page` | create, update, delete | page id | |
| `page_component` | create, update, delete | component id | |
| `page_component_group` | create, update, delete | group id | |
| `page_subscriber` | create, update, delete | subscriber id | metadata on every verb; scope edits are off-row |
| `status_report` | create, update, delete | report id | |
| `status_report_update` | create, update, delete | update id | `metadata.statusReportId` |
| `maintenance` | create, update, delete | maintenance id | |
| `maintenance_update` | create, update, delete | update id | `metadata.maintenanceId` |
| `incident` | create, update, delete | incident id | |
| `incident_event` | create | event id | append-only timeline |
| `incident_postmortem` | create, update | postmortem id | |
| `incident_sla_policy` | create, update, delete | policy id | |
| `notification` | create, update, delete | channel id | |
| `api_key` | create, delete | key id | revoke is `delete` |
| `oauth_grant` | create, delete | grant id | every revocation path is `delete` |
| `integration` | create, update, delete | integration id | snapshot via `snapshotIntegration` |
| `slack_user` | create, delete | mapping id | |
| `workspace` | update | workspace id | |
| `workspace_sso` | create, update, delete | workspace id | `delete` = a domain dropped; SSO off is an `update` |
| `invitation` | create, update, delete | invitation id | acceptance is `update` |
| `member` | create, update, delete | user id | `create` only for SSO JIT; `update` only for ownership transfer, two rows paired by required metadata |
| `user` | delete | user id | account deletion |

## Adding an audited mutation

1. **Find or add the variant.** An existing entity: reuse its
   `create` / `update` / `delete`. A new entity: add an `xActions` array in
   `validation.ts` and spread it into `auditActionSchema`. Use
   `optionalMetadata` only when step 3 needs it. There is no escape hatch: an
   operation that is not a create, update or delete on a workspace entity
   stays out of the audit log (chat sessions, test sends).
2. **Emit inside the transaction**, after the write, through `tx`, with
   `before` from the fetch-or-throw helper and `after` from `.returning()`.
3. **Snapshot safely** (see Snapshot hygiene). Put side-channel context in
   `metadata`.
4. **Wire the dashboard.** An entity type the dashboard can show gets an
   `entityKinds` entry in `apps/dashboard/src/data/entity-refs.client.ts`:
   `auditType` resolves the row's entity cell, `fields` resolve every
   `*Id` / `*Ids` key in the diff to a link. A new `*Id` field in an
   agent-tool schema fails `entity-refs.coverage.test.ts` until it is mapped
   there or listed as not a ref.
5. **Test it.** Assert the row with `expectAuditRow({ workspaceId, action,
   entityType, entityId, actorType? })` from `packages/services/test/helpers.ts`.
   For an update, also cover the no-op path if the verb can be called with
   unchanged input.

## Reading

`listAuditLogs` and `getAuditLog` in `packages/services/src/audit/`:

- **Workspace-scoped** by `ctx.workspace.id`, newest first, sorted
  `(createdAt DESC, id DESC)`.
- **14-day read window** (`READ_WINDOW_DAYS`). This caps what a leaked session
  can pull; it is not retention. Rows are kept indefinitely.
- **Actor user** is a left join that excludes soft-deleted users, so a deleted
  account reads as `user: null`, the same as a system or webhook actor. Display
  falls back to `${actorType}:${actorId}`.
- **Plan-gated** by `workspace.limits["audit-log"]`: the settings page shows the
  upsell, the agent tools throw `ForbiddenError`, and MCP skips registering
  them so they never appear in `tools/list`.
- **Scope:** the tools require the legacy umbrella `read`, because a row's
  snapshot can belong to any group. The readers themselves call no
  `requireScope`; the dashboard tRPC procedures are session-only.

## Tests

- Suites assert with `expectAuditRow` and clean up with `clearAuditLog(workspaceId)`
  or `clearAuditLogFor({ entityType, entityIds })`, never a global delete.
- **Audit rows outlive their entities.** `audit_log` has no foreign keys, and
  SQLite recycles `INTEGER PRIMARY KEY` ids after deletes. A suite that creates
  entities on the committed db and deletes them in cleanup must also call
  `clearAuditLogFor(...)`, or a later suite's new entity lands on the orphan's
  id and inherits its actor. That failure shows up in an unrelated suite.
- `apps/workflows` stubs the checker trail with `stubPublishAuditLog()` from
  `apps/workflows/src/test/stub-audit-log.ts`.
