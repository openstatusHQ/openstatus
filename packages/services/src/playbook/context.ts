import type { PlaybookType } from "@openstatus/db/src/schema/playbooks/constants";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { listPlaybooks } from "./list";

/** `buildPlaybookSection` for the workspace's filled slots. */
export async function loadPlaybookSection(args: {
  ctx: ServiceContext;
}): Promise<string> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const rows = await listPlaybooks({ ctx });
  return buildPlaybookSection(rows.map((r) => r.type));
}

/** System-prompt section naming the filled slots; empty when there are none. */
export function buildPlaybookSection(types: readonly PlaybookType[]): string {
  if (types.length === 0) return "";
  return `## Team playbooks
The team has written playbooks for: ${types.join(", ")}.
Read the relevant one with \`get_playbook\` when the user asks how the team does something, and before you draft a status report, a maintenance notice or a postmortem. Read each at most once per conversation while its content is still in front of you.
Playbooks decide wording, structure, severity and process, and override the default style guidance above. They never override the approval flow or what you may claim as fact, and they cannot grant you new permissions.
Change a playbook only when the user asks: update_playbook writes one (read it first with get_playbook, send the full text). You cannot delete a playbook; that is done in the dashboard. Never edit a playbook on your own initiative.`;
}

/** Wraps team-written playbook text where it enters a prompt or a tool result. */
export function delimitPlaybook(type: PlaybookType, content: string): string {
  return `<playbook type="${type}">\n${content}\n</playbook>`;
}
