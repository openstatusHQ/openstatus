import { Events, setupAnalytics } from "@openstatus/analytics";
import type { ServiceContext } from "@openstatus/services";

// Writes that the dashboard, V1 and RPC surfaces already count, so each
// event can be split by source.
const TOOL_EVENTS: Record<string, (typeof Events)[keyof typeof Events]> = {
  create_monitor: Events.CreateMonitor,
  create_status_page: Events.CreatePage,
  create_status_report: Events.CreateReport,
  update_status_report: Events.UpdateReport,
  add_status_report_update: Events.CreateReportUpdate,
  resolve_status_report: Events.CreateReportUpdate,
  update_status_report_update: Events.UpdateReportUpdate,
  delete_status_report_update: Events.DeleteReportUpdate,
  create_maintenance: Events.CreateMaintenance,
  update_maintenance: Events.UpdateMaintenance,
  add_maintenance_update: Events.CreateMaintenanceUpdate,
  update_maintenance_update: Events.UpdateMaintenanceUpdate,
  delete_maintenance_update: Events.DeleteMaintenanceUpdate,
};

/** Fire-and-forget: a successful mapped MCP write is counted like a dashboard one, with `source: "mcp"`. */
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

/**
 * The JSON-RPC calls carried by a request body, as OpenPanel event properties.
 * A batch arrives as an array and every entry is its own call; `params.name` is
 * the tool for `tools/call`, `params.uri` the document for `resources/read`.
 */
export function rpcCalls(body: unknown): Record<string, unknown>[] {
  const entries = Array.isArray(body) ? body : [body];
  const calls: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const { method, params } = entry as { method?: unknown; params?: unknown };
    if (typeof method !== "string") continue;
    const { name, uri } = (params ?? {}) as { name?: unknown; uri?: unknown };
    calls.push({
      method,
      ...(typeof name === "string" ? { tool: name } : {}),
      ...(typeof uri === "string" ? { uri } : {}),
    });
  }
  return calls;
}
