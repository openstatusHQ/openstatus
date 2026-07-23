import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { getPageUrl } from "../page-urls";
import type { Presenter } from "./types";

export const createMaintenancePresenter: Presenter = async ({
  input,
  output,
  notify,
}) => {
  const i = input as AgentToolInput<"create_maintenance">;
  const o = output as AgentToolOutput<"create_maintenance">;
  const url = o.pageId ? await getPageUrl(o.pageId) : null;
  return `:white_check_mark: Maintenance *${i.title}* scheduled${notify ? " and subscribers notified" : ""}.${url ? `\n<${url}|View status page>` : ""}`;
};
