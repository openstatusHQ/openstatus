import type { ServiceContext } from "@openstatus/services";
import type { AnyAgentTool } from "@openstatus/services/agent-tools";

import { defaultPresenter } from "./default";
import {
  declareIncidentPresenter,
  resolveIncidentPresenter,
  updateIncidentPresenter,
} from "./incident";
import { createMaintenancePresenter } from "./maintenance";
import {
  addStatusReportUpdatePresenter,
  createStatusReportPresenter,
  resolveStatusReportPresenter,
  updateStatusReportPresenter,
} from "./status-report";
import type { Presenter } from "./types";

export const presenters: Record<string, Presenter> = {
  create_status_report: createStatusReportPresenter,
  add_status_report_update: addStatusReportUpdatePresenter,
  update_status_report: updateStatusReportPresenter,
  resolve_status_report: resolveStatusReportPresenter,
  create_maintenance: createMaintenancePresenter,
  declare_incident: declareIncidentPresenter,
  update_incident: updateIncidentPresenter,
  resolve_incident: resolveIncidentPresenter,
};

export async function renderToolResult(args: {
  tool: AnyAgentTool;
  ctx: ServiceContext;
  input: unknown;
  output: unknown;
  notify: boolean;
}): Promise<string> {
  const custom = presenters[args.tool.name];
  if (custom) {
    return custom({
      input: args.input,
      output: args.output,
      ctx: args.ctx,
      notify: args.notify,
    });
  }
  return defaultPresenter({
    tool: args.tool,
    input: args.input,
    notify: args.notify,
  });
}
