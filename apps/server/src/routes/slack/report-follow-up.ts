import { getLogger } from "@logtape/logtape";
import type { ServiceContext } from "@openstatus/services";
import { escapeMrkdwn, getIncident } from "@openstatus/services/incident";
import type { KnownBlock, WebClient } from "@slack/web-api";
import { z } from "zod";

import { type ChannelMessage, fetchChannelHistory } from "./channel-context";
import {
  type DraftCandidates,
  draftStatusReport,
  loadDraftCandidates,
  type ReportDraft,
  storeDraft,
} from "./report-draft";

const logger = getLogger(["api-server", "slack", "report-follow-up"]);

export const REPORT_FOLLOW_UP_CREATE = "incident_report_follow_up_create";
export const REPORT_FOLLOW_UP_SKIP = "incident_report_follow_up_skip";
export const REPORT_FOLLOW_UP_TEXT =
  "Customers haven't been told yet. Create a status report?";

const SOURCE_MESSAGES = 50;
// Slack caps a section's text at 3,000 characters, after escaping.
const QUOTE_MAX = 2_900;

export const followUpValueSchema = z.object({
  incidentId: z.number().int(),
  draftId: z.string().optional(),
});
export type FollowUpValue = z.infer<typeof followUpValueSchema>;

export function readFollowUpValue(raw: string | undefined) {
  try {
    return followUpValueSchema.safeParse(JSON.parse(raw ?? "")).data;
  } catch {
    return undefined;
  }
}

function quote(text: string): string {
  const quoted = `>${escapeMrkdwn(text).replaceAll("\n", "\n>")}`;
  if (quoted.length <= QUOTE_MAX) return quoted;
  // Don't leave half an entity like `&am` at the cut.
  return `${quoted.slice(0, QUOTE_MAX - 1).replace(/&[a-z]*$/, "")}…`;
}

export function buildFollowUpBlocks(args: {
  value: FollowUpValue;
  draft?: ReportDraft;
  candidates?: DraftCandidates;
}): KnownBlock[] {
  const { value, draft, candidates } = args;
  const details: string[] = [];
  if (draft) {
    const page = candidates?.pages.find((p) => p.id === draft.pageId);
    if (page) details.push(`*Page:* ${escapeMrkdwn(page.title)}`);
    const names = (candidates?.components ?? [])
      .filter((c) => draft.componentIds.includes(c.id))
      .map((c) => escapeMrkdwn(c.name));
    if (names.length) details.push(`*Components:* ${names.join(", ")}`);
    if (draft.startedAt) {
      const iso = new Date(draft.startedAt * 1000).toISOString();
      const from = draft.startedAtSource
        ? ` (${escapeMrkdwn(draft.startedAtSource)})`
        : "";
      details.push(
        `*Started at:* <!date^${draft.startedAt}^{date_short_pretty} {time}|${iso}>${from}`,
      );
    }
  }
  const json = JSON.stringify(value);
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `:mega: ${REPORT_FOLLOW_UP_TEXT}` },
    },
    ...(draft?.message
      ? [
          {
            type: "section" as const,
            text: {
              type: "mrkdwn" as const,
              text: `Suggested update:\n${quote(draft.message)}`,
            },
          },
        ]
      : []),
    ...(details.length
      ? [
          {
            type: "context" as const,
            elements: [{ type: "mrkdwn" as const, text: details.join("   ") }],
          },
        ]
      : []),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Create status report" },
          action_id: REPORT_FOLLOW_UP_CREATE,
          value: json,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Not needed" },
          action_id: REPORT_FOLLOW_UP_SKIP,
          value: json,
        },
      ],
    },
  ];
}

/** After a declare: offer a drafted status report in the incident channel. */
export async function postReportFollowUp(args: {
  ctx: ServiceContext;
  slack: WebClient;
  incidentId: number;
  channelId: string;
  sourceChannelId?: string;
}): Promise<void> {
  const { ctx, slack, incidentId, channelId, sourceChannelId } = args;
  const incident = await getIncident({ ctx, input: { id: incidentId } });
  if (!incident || incident.statusReport || incident.closedAt) return;

  const sourceMessages: ChannelMessage[] = sourceChannelId
    ? await fetchChannelHistory(slack, sourceChannelId, {
        limit: SOURCE_MESSAGES,
        // The relink notice lands there first; the draft reads what came before.
        before: String(incident.createdAt.getTime() / 1000),
      }).catch((error) => {
        logger.info("slack follow-up could not read the source channel", {
          error,
          sourceChannelId,
        });
        return [];
      })
    : [];
  // Without candidates the card still offers the form, just without a draft.
  const candidates = await loadDraftCandidates(ctx).catch(
    (error): DraftCandidates => {
      logger.warn("slack follow-up could not load pages", {
        error,
        incidentId,
      });
      return { pages: [], components: [] };
    },
  );
  const draft = await draftStatusReport({
    incident,
    sourceMessages,
    candidates,
  });
  const draftId = draft ? await storeDraft(draft) : undefined;
  const value = { incidentId, ...(draftId ? { draftId } : {}) };

  await slack.chat.postMessage({
    channel: channelId,
    text: REPORT_FOLLOW_UP_TEXT,
    blocks: buildFollowUpBlocks({ value, draft, candidates }),
  });
}
