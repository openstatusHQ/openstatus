// MCP Server Card — SEP-1649 (https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127).
// Served at /.well-known/mcp/server-card.json.
//
// `OPENSTATUS_MCP_SERVER_VERSION` is read from apps/server/package.json at build time
// in next.config.ts and inlined via Next's `env` config — no manual sync.
const MCP_SERVER_VERSION = process.env.OPENSTATUS_MCP_SERVER_VERSION ?? "0.0.1";

const card = {
  $schema: "https://modelcontextprotocol.io/schemas/server-card/draft.json",
  serverInfo: {
    name: "openstatus",
    version: MCP_SERVER_VERSION,
    title: "Openstatus",
    description:
      "Read and update openstatus status pages, status reports, and maintenance windows from any Model Context Protocol client.",
    homepage: "https://www.openstatus.dev/tooling/mcp-server",
    documentation: "https://docs.openstatus.dev/reference/mcp-server/",
    vendor: { name: "Openstatus", url: "https://www.openstatus.dev" },
    license: "AGPL-3.0",
  },
  transport: {
    type: "streamable-http",
    url: "https://api.openstatus.dev/mcp",
  },
  authentication: {
    type: "apiKey",
    in: "header",
    name: "x-openstatus-key",
    description:
      "Workspace API key. Generate one in Settings → API Tokens. Same credential used by the CLI, REST API, and Terraform provider.",
  },
  capabilities: {
    tools: { listChanged: false },
  },
  tools: [
    {
      name: "list_status_pages",
      description: "List status pages in the workspace.",
    },
    {
      name: "list_status_reports",
      description: "List status reports for a given status page.",
    },
    {
      name: "create_status_report",
      description:
        "Open a new status report (incident). Requires explicit notify: true | false.",
    },
    {
      name: "append_status_report_update",
      description:
        "Append an update to an open status report. Requires explicit notify: true | false.",
    },
    {
      name: "resolve_status_report",
      description:
        "Resolve an open status report. Requires explicit notify: true | false.",
    },
    {
      name: "update_status_report",
      description: "Edit metadata on an existing status report.",
    },
    {
      name: "create_maintenance",
      description:
        "Schedule a maintenance window. Requires explicit notify: true | false.",
    },
    {
      name: "update_maintenance",
      description: "Adjust a scheduled maintenance window.",
    },
  ],
  links: {
    "service-doc": "https://docs.openstatus.dev/reference/mcp-server/",
    "service-desc": "https://api.openstatus.dev/openapi",
    "terms-of-service": "https://www.openstatus.dev/terms",
    "privacy-policy": "https://www.openstatus.dev/privacy",
  },
};

const body = JSON.stringify(card);

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
