import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { getReportUrl } from "../page-urls";
import type { Presenter } from "./types";

export const createStatusReportPresenter: Presenter = async ({
  input,
  output,
  notify,
}) => {
  const i = input as AgentToolInput<"create_status_report">;
  const o = output as AgentToolOutput<"create_status_report">;
  const url = o.statusReport.pageId
    ? await getReportUrl(o.statusReport.pageId, o.statusReport.id)
    : null;
  return `:white_check_mark: Status report *${i.title}* created${notify ? " and subscribers notified" : ""}.${url ? `\n<${url}|View on status page>` : ""}`;
};

export const addStatusReportUpdatePresenter: Presenter = async ({
  input,
  output,
  notify,
}) => {
  const i = input as AgentToolInput<"add_status_report_update">;
  const o = output as AgentToolOutput<"add_status_report_update">;
  const url = o.statusReport.pageId
    ? await getReportUrl(o.statusReport.pageId, o.statusReport.id)
    : null;
  return `:white_check_mark: Update added to *${o.statusReport.title}* (${i.status})${notify ? " and subscribers notified" : ""}.\n>${i.message}${url ? `\n<${url}|View on status page>` : ""}`;
};

export const updateStatusReportPresenter: Presenter = ({ input, output }) => {
  const i = input as AgentToolInput<"update_status_report">;
  const o = output as AgentToolOutput<"update_status_report">;
  return `:white_check_mark: Status report *${i.title ?? o.title}* updated.`;
};

export const resolveStatusReportPresenter: Presenter = async ({
  input,
  output,
  notify,
}) => {
  const i = input as AgentToolInput<"resolve_status_report">;
  const o = output as AgentToolOutput<"resolve_status_report">;
  const url = o.statusReport.pageId
    ? await getReportUrl(o.statusReport.pageId, o.statusReport.id)
    : null;
  return `:white_check_mark: *${o.statusReport.title}* resolved${notify ? " and subscribers notified" : ""}.${i.message ? `\n>${i.message}` : ""}${url ? `\n<${url}|View on status page>` : ""}`;
};
