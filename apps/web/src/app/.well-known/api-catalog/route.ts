// API catalog for automated API discovery — RFC 9727.
// Served as application/linkset+json per RFC 9264.
const linkset = {
  linkset: [
    {
      anchor: "https://api.openstatus.dev",
      "service-desc": [
        {
          href: "https://api.openstatus.dev/openapi",
          type: "application/json",
          title: "Openstatus API — OpenAPI description",
        },
      ],
      "service-doc": [
        {
          href: "https://docs.openstatus.dev",
          type: "text/html",
          title: "Openstatus documentation",
        },
      ],
      status: [
        {
          href: "https://status.openstatus.dev",
          type: "text/html",
          title: "Openstatus status page",
        },
      ],
      "terms-of-service": [
        {
          href: "https://www.openstatus.dev/terms",
          type: "text/html",
        },
      ],
      "privacy-policy": [
        {
          href: "https://www.openstatus.dev/privacy",
          type: "text/html",
        },
      ],
    },
    {
      anchor: "https://api.openstatus.dev/mcp",
      "service-desc": [
        {
          href: "https://www.openstatus.dev/.well-known/mcp/server-card.json",
          type: "application/json",
          title: "Openstatus MCP server card (SEP-1649)",
        },
      ],
      "service-doc": [
        {
          href: "https://docs.openstatus.dev/reference/mcp-server/",
          type: "text/html",
          title: "Openstatus MCP server reference",
        },
      ],
    },
  ],
};

const body = JSON.stringify(linkset);

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
