import {
  displayName,
  escapeMrkdwn,
  incidentSlaNoticeBlocks,
  parseIncidentSlaNoticeButtonValue,
} from "@openstatus/services/incident";

import type { SlackConfig } from "./config";
import { acknowledgeFromCard } from "./incident-slack";
import type { SlackWorkspace } from "./workspace-resolver";

/** A response notice's Acknowledge button: acknowledges like the card, then redraws the notice. */
export async function acknowledgeFromNotice(args: {
  resolved: SlackWorkspace;
  config: SlackConfig;
  teamId: string;
  slackUserId: string;
  channelId: string;
  messageTs: string;
  value: string | undefined;
}): Promise<void> {
  const notice = parseIncidentSlaNoticeButtonValue(args.value);
  if (!notice) return;
  const { value: _, ...rest } = args;
  await acknowledgeFromCard({
    ...rest,
    incidentId: notice.incidentId,
    redraw: (current, acknowledgedHere) => {
      const by = acknowledgedHere
        ? `<@${args.slackUserId}>`
        : current.acknowledgedAt
          ? current.acknowledgedByUser
            ? escapeMrkdwn(displayName(current.acknowledgedByUser))
            : "someone else"
          : undefined;
      return incidentSlaNoticeBlocks({
        incident: current,
        kind: "response",
        notice: notice.notice,
        targetMinutes: notice.targetMinutes,
        dueAt: new Date(notice.dueAt),
        url: `${args.config.dashboardUrl}/incidents/${current.id}`,
        role: notice.role,
        acknowledgedBy: by,
      });
    },
  });
}
