import { Events, setupAnalytics } from "@openstatus/analytics";
import type { ServiceContext } from "@openstatus/services";

// Creates that the dashboard, V1 and RPC surfaces already count, so the
// activation funnel can split `monitor_created` by source.
const TOOL_EVENTS: Record<string, (typeof Events)[keyof typeof Events]> = {
  create_monitor: Events.CreateMonitor,
  create_status_page: Events.CreatePage,
};

/** Fire-and-forget: a successful MCP create is counted like a dashboard one, with `source: "mcp"`. */
export function trackToolSuccess(ctx: ServiceContext, toolName: string): void {
  const event = TOOL_EVENTS[toolName];
  if (!event) return;
  const { workspace } = ctx;
  setupAnalytics({
    userId: `api_${workspace.id}`,
    workspaceId: `${workspace.id}`,
    workspaceName: workspace.name || workspace.slug,
    plan: workspace.plan,
    source: "mcp",
  })
    .then((analytics) => analytics.track({ ...event, tool: toolName }))
    .catch(() => {});
}
