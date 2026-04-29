---
name: openstatus-mcp
description: Use the openstatus MCP server to read and update status pages, status reports, and maintenance windows from any Model Context Protocol client (Claude, ChatGPT, Cursor, etc.). Use when an AI assistant needs to post an incident, append an update, resolve a report, or schedule maintenance for an openstatus workspace.
---

# openstatus MCP server

The openstatus MCP server is a remote, streamable-HTTP endpoint at `https://api.openstatus.dev/mcp`. It exposes 8 tools scoped to a single workspace.

## Connect

Add this to your MCP client config (Claude Desktop, Cursor, ChatGPT custom connector, etc.):

```json
{
  "mcpServers": {
    "openstatus": {
      "url": "https://api.openstatus.dev/mcp",
      "headers": {
        "x-openstatus-key": "os_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

The `x-openstatus-key` header is the same API key used by the CLI, REST API, and Terraform provider. Generate one in **Settings → API Tokens**. There is no separate MCP OAuth flow.

## Tools

- `list_status_pages` — discover pages the workspace owns.
- `list_status_reports` — read incidents on a page.
- `create_status_report` — open a new incident.
- `append_status_report_update` — post an update on an open incident.
- `resolve_status_report` — close an incident.
- `update_status_report` — edit incident metadata.
- `create_maintenance` — schedule a maintenance window.
- `update_maintenance` — adjust a scheduled window.

Every mutation tool requires an explicit `notify: true | false` argument. The model must decide whether subscribers are paged. There is no implicit default.

## Audit

All MCP mutations are written to the workspace audit log with `actor_type = 'mcp'`, so any change can be traced back to a key, a user, and the MCP transport.

## Reference

- Full tool schemas and error codes: <https://docs.openstatus.dev/reference/mcp-server/>
- Product overview: <https://www.openstatus.dev/tooling/mcp-server>
