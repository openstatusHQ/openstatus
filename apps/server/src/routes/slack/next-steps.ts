import { INCIDENT_CARD_ACTIONS } from "@openstatus/services/incident";
import type { KnownBlock } from "@slack/web-api";
import { z } from "zod";

export const NEXT_STEP_ACTIONS = {
  postUpdate: "report_next_post_update",
  resolve: "report_next_resolve",
} as const;

const incidentOutput = z.object({ id: z.number().int() });
const reportOutput = z.object({
  statusReport: z.object({ id: z.number().int(), status: z.string() }),
});

function button(text: string, actionId: string, value: number) {
  return {
    type: "button" as const,
    text: { type: "plain_text" as const, text },
    action_id: actionId,
    value: String(value),
  };
}

function step(
  text: string,
  sentence: string,
  buttons: ReturnType<typeof button>[],
): KnownBlock[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: text.slice(0, 3000) } },
    { type: "context", elements: [{ type: "mrkdwn", text: sentence }] },
    { type: "actions", elements: buttons },
  ];
}

/** The approved card's result, plus what usually comes next. */
export function nextStepBlocks(
  toolName: string,
  output: object,
  text: string,
): KnownBlock[] | undefined {
  if (toolName === "declare_incident") {
    const parsed = incidentOutput.safeParse(output);
    if (!parsed.success) return undefined;
    return step(text, "Next: tell customers.", [
      button(
        "Update status page",
        INCIDENT_CARD_ACTIONS.statusPage,
        parsed.data.id,
      ),
    ]);
  }
  if (
    toolName === "create_status_report" ||
    toolName === "add_status_report_update"
  ) {
    const parsed = reportOutput.safeParse(output);
    if (!parsed.success || parsed.data.statusReport.status === "resolved") {
      return undefined;
    }
    const id = parsed.data.statusReport.id;
    return step(text, "Next: post an update when you know more.", [
      button("Post update", NEXT_STEP_ACTIONS.postUpdate, id),
      button("Resolve", NEXT_STEP_ACTIONS.resolve, id),
    ]);
  }
  return undefined;
}
