import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  renderMonitorChartTool,
  summarizeMonitorChart,
} from "@openstatus/services/agent-tools";

import { runTool } from "../adapter";
import { MONITOR_CHART_URI, uiToolMeta } from "../ui-resources";
import { registerScopedTool } from "./register-scoped";
import { assertShape } from "./registry-adapter";

// Not `registerRegistryTool`: the view needs `_meta`, hosts without MCP Apps
// need prose rather than JSON, and `?experimental=1` replaces the tool's feature flag.
export function registerMonitorChartTool(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  const tool = renderMonitorChartTool;
  const registered = new Map<string, RegisteredTool>();
  const handle = registerScopedTool(
    server,
    ctx,
    tool.name,
    {
      scope: tool.scope,
      description: tool.description,
      annotations: {
        title: "Monitor latency chart",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: assertShape(tool.inputSchema, tool.name, "input"),
      outputSchema: assertShape(tool.outputSchema, tool.name, "output"),
      _meta: uiToolMeta(MONITOR_CHART_URI),
    },
    async (input: unknown) =>
      runTool(
        () => tool.run({ ctx, input: tool.inputSchema.parse(input) }),
        (model) => ({
          content: [{ type: "text", text: summarizeMonitorChart(model) }],
          structuredContent: model,
        }),
      ),
  );
  if (handle) registered.set(tool.name, handle);
  return registered;
}
