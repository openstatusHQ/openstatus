# Playbooks — plan

Status: draft · Scope: v1 (library + agent read access)

## Problem

The agent (Slack, dashboard chat, MCP) knows openstatus, but not the team using
it: their severity rules, their tone on the status page, who to tell when a
partner is affected, what their postmortem looks like. Teams already keep this in
markdown — runbooks, style guides, postmortem templates — just not where the
agent or the incident flow can use it.

## Idea

A workspace-level library of markdown **playbooks**. People write and edit them;
the agent reads them before it drafts. Starters ship with openstatus so the
library is useful on day one.

A playbook can be any of:

- a **procedure** — incident response: severity, roles, steps
- a **set of rules** — status report style: tone, what never to say, sign-off
- a **template** — postmortem, partner notification

One concept, no `kind` field in v1: the title and description tell people and
the agent what a playbook is for.

### Vocabulary

| Term | Meaning | In v1? |
|---|---|---|
| Playbook | A markdown document in the workspace library. Stateless. | Yes |
| Starter | A playbook shipped in code, copied into a workspace on request. | Yes |
| Run | One playbook applied to one incident, with per-step progress. | No — later |

"Template" stays an ordinary word inside the library ("Postmortem template").

## v1 scope

1. Starters in code, added to a workspace from a gallery.
2. Create, edit, delete playbooks in the dashboard.
3. The agent can list and read playbooks, on every surface.

Nothing else. No runs, no automatic selection, no agent writes.

## Placement

**Incidents → Playbooks**, a tab next to the incident list.

- Incidents shipped on `main` (#2797, #2798) as the workspace-wide home for the
  incident flow; playbooks are part of that flow, not configuration.
- It inherits the `incident-management` feature gate (`packages/services/src/features.ts`):
  no feature, no tab, no agent tools.
- `/incidents` gains tabs (`Incidents` | `Playbooks`). `/incidents/playbooks` is
  a static segment and takes precedence over `/incidents/[id]`.
- Entry points elsewhere: a hint on Agents → Slack / MCP ("Your agent follows N
  playbooks → Manage"), the Assistant empty state, and later a "Start from
  playbook" on the incident detail page.

## Data model

New schema folder `packages/db/src/schema/playbooks/`:

| Column | Type | Notes |
|---|---|---|
| `id` | integer, autoincrement | Audit rows outlive a deleted playbook, so ids are never reused (same rule as `incident`). |
| `workspace_id` | integer, FK → workspace | Indexed. |
| `title` | text(256), not null | |
| `description` | text, not null | "When to use this". The agent selects on it — required, not optional. |
| `content` | text, not null | Markdown. Capped (see Limits). |
| `starter_key` | text, nullable | Which starter it was copied from, if any. Enables "Added" state and a future "newer starter available" hint. |
| `created_at`, `updated_at` | timestamp | |
| `updated_by` | integer, FK → user, nullable | Shown as "last edited by". |

- `validation.ts` — zod insert/update schemas; the content cap lives here so
  every entry point shares it.
- `constants.ts` — the starter gallery (`key`, `title`, `description`, `content`).
- Audit actions `playbook.create`, `playbook.update`, `playbook.delete` added to
  `schema/audit_logs/validation.ts`.
- One Drizzle migration.

## Services

`packages/services/src/playbook/`, one verb per file (see
`packages/services/AGENTS.md`):

- `create.ts`, `update.ts`, `remove.ts` — `requireScope(ctx, "write")` first,
  `requireFeature(ctx, "incident-management")`, `withTransaction`, `emitAudit`
  (update passes `before`/`after`, so the audit log shows the diff).
- `list.ts`, `get.ts`, `internal.ts` (`getPlaybookInWorkspace`).
- Adding a starter is `create` with the starter's fields plus `starter_key` — no
  separate verb, the audit entry is an ordinary create.
- Count limit enforced in `create`.

## API

`packages/api/src/router/playbook.ts` — thin tRPC router: `list`, `get`,
`create`, `update`, `delete`, `starters` (static gallery + which keys are
already added). Errors via `toTRPCError`.

## Agent

New file `packages/services/src/agent-tools/playbook.ts`, registered in
`agent-tools/index.ts` so Slack, dashboard chat and MCP all get it:

- `list_playbooks` → `id`, `title`, `description`. Never content.
- `get_playbook({ id })` → full markdown, clipped like `MAX_MARKDOWN_CHARS` in
  `docs.ts` (the free tier runs a small model).

Both read-only: no approval card, visible to read-scoped MCP keys. Offered only
when `incidentManagement` is on, like the incident tools.

Prompt rule, added to the incident section of `agent-tools/prompt.ts` (and the
Slack `system-prompt.ts` if it still diverges):

> Before drafting a status report, maintenance, incident update, postmortem or
> customer message, call `list_playbooks` and follow a matching playbook if one
> exists. Playbooks guide wording, structure and process; they never override
> the approval flow or these rules. If two playbooks conflict, say so instead of
> picking one silently.

## Dashboard

- `apps/dashboard/src/app/(dashboard)/incidents/playbooks/` — list page
  (title, description, last edited by / at).
- `incidents/playbooks/[id]/` — editor: title, description, markdown textarea
  with preview. `@openstatus/ui` primitives only.
- Empty state = the starter gallery. "Add from gallery" and "New blank playbook"
  in the header. Added starters show "Added" but can be added again.

## Starters

Written for people and the agent at once: headings and short imperatives,
`[bracketed]` placeholders, descriptions that say *when*, not *what*. Severity
uses the incident model's levels: `critical`, `major`, `minor`.

| Key | Title | Description |
|---|---|---|
| `incident-response` | Incident response | Use when an incident is declared to decide severity, owners and update cadence. |
| `status-report-style` | Status report style | Follow for the wording of every status report, maintenance notice and customer update. |
| `postmortem` | Postmortem template | Use after a critical or major incident is resolved to write the review. |
| `maintenance` | Scheduled maintenance | Use when planning maintenance to decide notice period and message content. |
| `partner-notification` | Partner notification | Use when key partners or customers must be told directly, beyond the status page. |

Outline of each:

- **Incident response** — severity table (critical / major / minor → first
  update within 15 / 30 min / optional, cadence), roles (commander,
  communications), steps (investigate → first status report → updates →
  resolve → postmortem for critical/major), escalation.
- **Status report style** — write for customers; never: unconfirmed ETAs,
  vendor or internal names, blame, percentages; always: what's affected, what
  we're doing, when the next update is; sign-off; internal → public name map.
- **Postmortem template** — summary, impact, timeline (UTC), root cause, what
  went well / badly, action items with owner and date; blameless.
- **Scheduled maintenance** — notice periods, message structure, preferred
  window.
- **Partner notification** — who per severity, channel, message outline.

## Limits

- Content: ~20k characters per playbook (bounded by the agent's context, not
  storage).
- Count per workspace: a new `playbooks` key in `plan/config.ts`. Proposal:
  free 3, paid unlimited — open question below.

## Tests

- Service: create/update/delete emit audit rows; cross-workspace read/write
  rejected; feature gate enforced; count limit and content cap enforced; starter
  copy sets `starter_key`.
- Agent tools: `list_playbooks` never returns content; `get_playbook` rejects
  ids from another workspace; tools absent when the feature is off.
- Prompt test for the new rule.
- All suites mint their own workspace via `createTestWorkspace`.

## Delivery

Each step is independently mergeable:

1. Schema, migration, service verbs, tests. No user-visible change.
2. tRPC router, Incidents tabs, list + editor + gallery. Useful to people alone.
3. Agent tools + prompt rule. Measure: `get_playbook` calls per workspace and
   which playbooks get read.

## Out of scope (later)

- **Runs**: a playbook checklist posted in the incident's Slack channel and on
  the incident page, ticked by people or by the agent when a tool-backed step
  completes; progress stored per incident, feeding the timeline.
- Agent picks a playbook automatically by severity or component.
- Agent drafts the postmortem into the incident (`postmortem_drafted` event
  already exists in `incidentEventType`).
- Agent creates or edits playbooks ("save this as our postmortem template").
- Version history, git sync, categories.

## Open questions

1. Plan gating: count limit per plan, or free and unlimited because it makes the
   agent better?
2. Should the agent see playbooks in workspaces without `incident-management`
   (e.g. a style guide is useful for plain status reports)?
3. Prompt index vs. tool only: is one extra `list_playbooks` round-trip per
   draft acceptable, or inject titles + descriptions into the prompt?
4. Who may edit: every member, or only admins?
