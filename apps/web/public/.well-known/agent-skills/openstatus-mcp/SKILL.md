---
name: openstatus-mcp
description: Use the openstatus MCP server to read monitors, notification channels, private locations and audit logs, and to read and update status pages, status reports, and maintenance windows from any Model Context Protocol client (Claude, ChatGPT, Cursor, Codex, opencode, etc.). Use when an AI assistant needs to check a monitor's health, post an incident, append an update, resolve a report, or schedule maintenance for an openstatus workspace.
---

# openstatus MCP server

The openstatus MCP server is a remote, streamable-HTTP endpoint at `https://api.openstatus.dev/mcp`. It exposes 19 tools (17 on plans without the `audit-log` feature) scoped to a single workspace.

## Connect

### OAuth (recommended for interactive clients)

Point the client at the endpoint with no header. The server answers `401` with a `WWW-Authenticate` header, and any client implementing the MCP authorization spec (Claude.ai, Claude Desktop, Claude Code, ChatGPT, Cursor, Codex, opencode, VS Code) registers itself, opens the consent screen, and exchanges the code for an `os_oat_…` bearer token via PKCE. On the consent screen you pick the **workspace** and the **access** level (read-only or read & write). Nothing to copy.

```json
{
  "mcpServers": {
    "openstatus": {
      "type": "http",
      "url": "https://api.openstatus.dev/mcp"
    }
  }
}
```

```bash
claude mcp add --transport http --scope user openstatus https://api.openstatus.dev/mcp
```

Connected apps are listed under **Settings > Integrations > Connected apps**, where they can be revoked at any time.

### API key (CI, cron, headless agents)

Send an openstatus API key in the `x-openstatus-key` header. It is the same key used by the CLI, REST API, and Terraform provider; create one in **Settings > General**, in the **API Keys** card. When both credentials are present, the header wins.

```json
{
  "mcpServers": {
    "openstatus": {
      "type": "http",
      "url": "https://api.openstatus.dev/mcp",
      "headers": {
        "x-openstatus-key": "os_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Scopes

Both credentials carry a scope. **Read-only** credentials only see `list_*` and `get_*` tools in `tools/list`; mutation tools are not registered and cannot be called. **Read & write** exposes every tool. An API key's scope is fixed at creation; an OAuth grant's scope is chosen on the consent screen.

## Tools

### Status pages

- `list_status_pages` — discover pages the workspace owns. Resolves the `pageId` required by the mutation tools.
- `list_page_components` — discover the components on a page (id, name, type, linked monitor). Resolves the `pageComponentIds` accepted by the create/update tools below.

### Status reports

- `list_status_reports` — read incidents on a page (`filter: "active" | "all"`, paginated).
- `create_status_report` — open a new incident.
- `add_status_report_update` — post an update on an open incident.
- `update_status_report` — edit incident metadata (title, status, components) without a public update.
- `resolve_status_report` — close an incident with a final update.

### Maintenance

- `list_maintenances` — read scheduled maintenance windows (paginated).
- `create_maintenance` — schedule a maintenance window (`from` / `to` as ISO 8601).

### Monitors (read-only)

- `list_monitors` — list monitors with `activeIncidentCount`. Resolves the numeric `monitorId` the other monitor tools require.
- `get_monitor` — full configuration: URL, regions, periodicity, retries, notification channels, tags.
- `get_monitor_status` — per-region current health (active / degraded / error).
- `get_monitor_summary` — success/degraded/error counts and p50–p99 latency over `1d`, `7d`, or `14d`.
- `list_response_logs` — recent per-region check results (status code, latency) over `1d`, `7d`, or `14d`. HTTP monitors only.
- `get_response_log` — one check in full: timing breakdown, redacted headers, error, assertion results.

### Workspace (read-only)

- `list_notifications` — notification channels and the monitors wired to each. Credentials are never exposed.
- `list_private_locations` — private locations with status and `lastSeenAt`. Agent tokens are never exposed.
- `list_audit_logs` — audit-log entries, last 14 days, optional `entityType` + `entityId` filter. Requires the `audit-log` plan feature.
- `get_audit_log` — before/after snapshots and `changedFields` for one entry. Requires the `audit-log` plan feature.

### Resources

The server also exposes three read-only resources on any credential: `openapi-specification`, `mcp-server-reference`, and `site-index` (`llms.txt`).

## Rules for mutations

- Every publishing tool (`create_status_report`, `add_status_report_update`, `resolve_status_report`, `create_maintenance`) requires an explicit `notify: true | false` argument. There is no default; the model must ask the user whether subscribers are paged. `update_status_report` has no `notify` field.
- Notifications dispatch inside the same call. An update posted with `notify: false` can never be re-sent later.
- Never guess a numeric id. Call `list_status_pages` and `list_page_components` first; ids outside the workspace come back as `NOT_FOUND`.
- Draft the title, status, message and components, show the draft to the user, confirm `notify`, then call the tool.

## Audit

All MCP mutations are written to the workspace audit log with `actor_type = 'mcp'`, `actor_id` set to the credential (API key id or `oat_<grant id>`), and `actor_user_id` set to the person behind it, so any change can be traced back to a key or OAuth grant, a user, and the MCP transport.

## Reference

- Full tool schemas, OAuth endpoints and error codes: <https://www.openstatus.dev/docs/reference/mcp-server/>
- Product overview: <https://www.openstatus.dev/tooling/mcp-server>
