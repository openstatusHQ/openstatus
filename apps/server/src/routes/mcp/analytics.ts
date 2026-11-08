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
