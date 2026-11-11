# Incident SLA — implementation plan

Response and resolution targets, a fixed update cadence and breach notices for
incidents, configured by one policy per workspace.

## Decisions

| Topic | Decision |
| --- | --- |
| Audience | Product feature, behind a new paid limit `incident-sla` |
| Policy scope | One policy per workspace, no customer dimension |
| Severities | Unchanged: `critical`, `major`, `minor` |
| Clock start | `declaredAt`, wall-clock, no pausing |
| Response met | Explicit acknowledge; a human declare acknowledges automatically |
| Resolution met | `resolved` only; `mitigated` does not count |
| Severity change | Due time = `declaredAt` + snapshot target of the current severity |
| Policy edits | Targets are snapshotted on the incident at declare |
| Update cadence | Fixed interval, reset only by an update on the linked status report (any note if none is linked) |
| Without a policy | Today's stale reminder (1h/4h/24h, backoff) is unchanged |
| Breach | One `incident_event` per timer, plus a notice |
| Escalation | None beyond the response-breach notice |
| Delivery | Slack (channel, else commander, else declarer) and email to commander and declarer |
| Dashboard | Policy form in settings, badge on list and detail, events in the timeline |
| API / MCP | SLA fields readable, acknowledge available; policy editing is dashboard-only |
| Edge cases | Canceled never breaches; reopen runs against the original due time; incidents without a snapshot are not tracked |

Defaults, each field optional (empty turns that timer off for that severity):

| Severity | Response | Resolution | Updates |
| --- | --- | --- | --- |
| critical | 1h | 4h | 2h |
| major | 4h | 24h | 4h |
| minor | 24h | 72h | 12h |

Out of scope: compliance report, status page exposure, paging providers
(PagerDuty, Opsgenie, SMS), on-call schedules, business hours, support credits.

## Data model

One migration in `packages/db`.

**New table `incident_sla_policy`**

- `id`, `workspace_id` (unique, references `workspace`), `targets` (JSON text),
  `created_at`, `updated_at`.
- `targets` is `Record<IncidentSeverity, { responseMinutes?, resolutionMinutes?, updateMinutes? }>`,
  validated by a zod schema next to the table. Minutes, positive integers.
- A row existing means the policy is on; deleting it turns the feature off.

**`incident` — three new nullable columns**

- `acknowledged_at` (timestamp), `acknowledged_by` (references `user`).
- `sla_targets` (JSON text): the policy's `targets` copied at declare. `null`
  means the incident is not tracked.

**`incident_event.type` — three new values**

- `acknowledged`
- `sla_response_breached`
- `sla_resolution_breached`

**Plan limit**

- `"incident-sla": z.boolean().prefault(false)` in
  `packages/db/src/schema/plan/schema.ts`; enabled on the paid plans in
  `config.ts`, next to `slack-agent`.

**Audit**

- New actions `incident_sla_policy.upsert` and `incident_sla_policy.delete` in
  `packages/db/src/schema/audit_logs/validation.ts`, and an `entityKinds` entry
  in `apps/dashboard/src/data/entity-refs.client.ts`.
- Acknowledge reuses `incident.update`.

## Services (`packages/services/src/incident`)

**Pure module `sla.ts`** — no DB, fully unit-tested.

- `slaState(incident, now)` returns, per timer (`response`, `resolution`):
  `dueAt`, `metAt`, and `status` of `untracked | running | met | breached`.
  - `dueAt = declaredAt + sla_targets[severity].<target>`.
  - Response `metAt` is `acknowledgedAt`; resolution `metAt` is `resolvedAt`
    while the status is `resolved`.
  - `canceled` yields `untracked` for both.
  - `met` after `dueAt` still reports as breached (late), so the badge and the
    event agree.
- `updateCadence(incident)` returns the interval for the current severity, or
  `null`.

**Policy verbs** (new folder `incident-sla-policy`, scope group `incidents`)

- `getIncidentSlaPolicy` (`incidents:read`).
- `upsertIncidentSlaPolicy`, `deleteIncidentSlaPolicy` (`incidents:write`),
  rejecting with a limit error when `incident-sla` is off. Both emit audit.
- Register the folder under the `incidents` group for the scope lint, and add
  the verbs to `SCOPES.md`.

**`declare.ts`**

- Inside the existing transaction, read the policy; if present and the limit is
  on, write `sla_targets`.
- If the actor is `user` or `slack`, set `acknowledgedAt = declaredAt` and
  `acknowledgedBy`. No separate `acknowledged` event in that case: the
  `declared` event already carries it.

**New verb `acknowledge.ts`**

- `acknowledgeIncident({ ctx, input: { id } })`, `incidents:write`.
- Conditional update on `acknowledged_at IS NULL`; a second call is a
  `ConflictError`. Rejects closed and canceled incidents.
- Sets both columns, emits audit, appends an `acknowledged` event, and runs the
  channel announcement through the existing effects.

**`update.ts` and `set-status.ts`**

- No stored due times, so severity changes and reopen need no extra writes:
  `slaState` derives everything from `declaredAt`, the snapshot and the current
  row.

**Read shape**

- `list` and the single-incident read attach `sla: slaState(row, now)` so every
  adapter gets the same computed fields.

## Cron (`reminders.ts`, `apps/workflows/src/cron/incident-reminders.ts`)

The tick currently skips a workspace without a usable Slack connection. Split
it into "what is due" and "where to send".

**What is due, per open or mitigated incident**

1. **Update reminder**
   - Tracked incident with a cadence: anchor is the latest update on the linked
     status report, else the latest incident event, else `declaredAt`. Window is
     `floor(elapsed / cadence)`; fire once per window ≥ 1.
   - Otherwise: the existing `reminderWindow` logic, untouched.
2. **Breach**
   - For each timer whose `slaState` is `breached` with no matching
     `sla_*_breached` event: append the event (system actor), then notify.
   - The event row is the dedupe, which also gives "logged once" on reopen.
   - Resolved incidents are checked too, so a late resolution between ticks is
     still recorded. Bound the query to incidents updated within the last day.

**Where to send**

- Slack, when the workspace has `slack-agent` and a connection: unchanged
  target order.
- Email, to commander and declarer (deduplicated), when the incident is
  tracked. New templates in `packages/emails` beside `incident-commander.tsx`:
  one for the update reminder, one for a breach.
- The Redis claim stays per incident, anchor and window, with a channel suffix
  so a failed Slack post does not resend the email.

**Tick frequency**

- Today `*/10 * * * *`, so a breach is noticed up to 10 minutes late. Move to
  `*/5` if that is too coarse for a 1h target; the event's `createdAt` is the
  detection time, the due time is in the message.

## Adapters

**tRPC (`packages/api/src/router/incident.ts`)**

- `acknowledge` mutation; `sla` on list and get.
- New `incidentSlaPolicy` router: `get`, `upsert`, `delete`.

**Slack (`apps/server/src/routes/slack`)**

- `incident-card.ts`: an Acknowledge button when `acknowledgedAt` is null, and
  a due-time line when tracked.
- `interactions.ts`: handler calling `acknowledgeIncident` with the Slack actor.
- `incident-events.ts`: render the three new event types.

**API and MCP**

- RPC handler and converters (`apps/server/src/routes/rpc/handlers/incident`):
  expose `acknowledgedAt`, due times and breach flags; add an acknowledge RPC.
- MCP and agent tools (`packages/services/src/agent-tools/incident.ts`,
  `apps/server/src/routes/mcp/tools/incident.ts`): same fields on reads, plus an
  `acknowledge_incident` write tool via `registerScopedTool`.

## Dashboard (`apps/dashboard`)

- **Settings:** an "Incident SLA" section in `settings/general` with a 3 × 3
  form (duration inputs), an enable/disable control, and the upgrade state when
  the limit is off.
- **Badge:** one `IncidentSlaBadge` component used in `incident-row.tsx` and
  `incident-heading.tsx`. Shows the nearest running timer as a countdown,
  `breached` in the destructive tone, nothing when untracked.
- **Acknowledge:** a button in `incident-heading.tsx`, visible only while
  `acknowledgedAt` is null.
- **Timeline:** labels and icons for the three new event types in
  `incident-timeline.tsx`.
- Follow `DESIGN.md` and verify with the `screenshot` skill.

## Tests

- `sla.test.ts`: every status of both timers, severity change, reopen,
  canceled, missing target, late acknowledge.
- Policy verbs: audit row, read-only actor rejected, limit off rejected.
- `declare`: snapshot written only with a policy and limit; auto-acknowledge by
  actor type.
- `acknowledge`: happy path, double call, closed incident, read-only actor.
- `reminders`: fixed cadence windows, status-report anchor versus note anchor,
  breach event written once, email without Slack, legacy behaviour without a
  policy.

## Order of work

1. Schema, migration, plan limit, audit actions.
2. `sla.ts` with tests.
3. Policy verbs, `declare` snapshot, `acknowledge` verb.
4. Cron: cadence, breach events, email delivery.
5. tRPC and dashboard (settings, badge, acknowledge, timeline).
6. Slack card and interaction.
7. API, MCP and agent tools; `SCOPES.md` and docs.

Steps 1–3 are one PR, 4 a second, 5 a third, 6–7 a fourth. Each is shippable:
until step 4 lands, timers show in data but nothing is pushed.

## Open points

- **API key declares:** `apiKey` and `mcp` actors do not auto-acknowledge, even
  when the key belongs to a user. Confirm that is wanted.
- **Cadence anchor field:** `status_report_update` has an editable `date` and a
  `createdAt`. The plan uses `createdAt`, so backdating an update does not
  silence a reminder.
- **Disabling the policy:** already-declared incidents keep their snapshot and
  stay tracked. The alternative is to stop tracking when the row is deleted.
