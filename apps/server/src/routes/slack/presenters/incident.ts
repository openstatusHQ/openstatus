import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { getIncidentDashboardUrl } from "../page-urls";
import type { Presenter } from "./types";

function link(id: number): string {
  return `<${getIncidentDashboardUrl(id)}|Open in openstatus>`;
}

export const declareIncidentPresenter: Presenter = ({ output }) => {
  const o = output as AgentToolOutput<"declare_incident">;
  return `:rotating_light: Incident *${o.title}* declared (${o.severity}).\n${link(o.id)}`;
};

export const updateIncidentPresenter: Presenter = ({ output }) => {
  const o = output as AgentToolOutput<"update_incident">;
  return `:white_check_mark: Incident *${o.title}* updated.\n${link(o.id)}`;
};

export const resolveIncidentPresenter: Presenter = ({ input, output }) => {
  const i = input as AgentToolInput<"resolve_incident">;
  const o = output as AgentToolOutput<"resolve_incident">;
  return `:white_check_mark: Incident *${o.title}* resolved.${i.note ? `\n> ${i.note}` : ""}\n${link(o.id)}`;
};
