// Server card (SEP-1649) for the anonymous status MCP endpoint. Kept apart
// from ../../server-card.json because that one describes the signed-in server.
const MCP_SERVER_VERSION = process.env.OPENSTATUS_MCP_SERVER_VERSION ?? "0.0.1";

const card = {
  $schema: "https://modelcontextprotocol.io/schemas/server-card/draft.json",
  serverInfo: {
    name: "openstatus-status",
    version: MCP_SERVER_VERSION,
    title: "Openstatus external status",
    description:
      "Is it down? Live status of 3,000+ third-party services (cloud, AI, SaaS, developer tools) from their official status pages and user reports. No login.",
    homepage: "https://www.openstatus.dev/status",
    vendor: { name: "Openstatus", url: "https://www.openstatus.dev" },
    license: "AGPL-3.0",
  },
  transport: {
    type: "streamable-http",
    url: "https://api.openstatus.dev/mcp/status",
  },
  authentication: { type: "none" },
  capabilities: { tools: { listChanged: false } },
  tools: [
    {
      name: "get_service_status",
      description:
        "Whether a third-party service, or one of its components, is down right now: verdict, affected components, open and recent incidents, user reports.",
    },
    {
      name: "list_active_issues",
      description:
        "Third-party services reporting a problem right now, worst first, optionally narrowed to a list of providers.",
    },
  ],
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
