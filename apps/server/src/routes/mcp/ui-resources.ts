import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import monitorChartHtml from "../../../static/mcp-app-monitor-chart";

// MCP Apps (SEP-1865): hosts render a resource with this MIME type in a sandboxed iframe.
export const UI_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

export const MONITOR_CHART_URI = "ui://openstatus/monitor-chart.html";

type UiResource = {
  name: string;
  uri: string;
  title: string;
  description: string;
  html: string;
};

export const UI_RESOURCES: UiResource[] = [
  {
    name: "monitor-chart",
    uri: MONITOR_CHART_URI,
    title: "openstatus monitor latency chart",
    description:
      "Interactive latency chart rendered by render_monitor_chart in hosts that support MCP Apps.",
    html: monitorChartHtml,
  },
];

/** `_meta` linking a tool to its view; the flat key is what pre-1.0 hosts read. */
export function uiToolMeta(resourceUri: string): Record<string, unknown> {
  return { ui: { resourceUri }, "ui/resourceUri": resourceUri };
}

export function registerUiResources(server: McpServer): void {
  for (const resource of UI_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: UI_RESOURCE_MIME_TYPE,
      },
      () => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: UI_RESOURCE_MIME_TYPE,
            text: resource.html,
            // the view is fully inlined: no csp domains to declare
            _meta: { ui: { prefersBorder: true } },
          },
        ],
      }),
    );
  }
}
