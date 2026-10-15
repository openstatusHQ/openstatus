import type { KnownBlock } from "@slack/web-api";

export const PUBLISH_STATUS_UPDATE_ACTION = "open_publish_status_update";

export const WELCOME_TEXT =
  "openstatus is in this channel. Mention it to draft a status page update.";

export function buildWelcomeBlocks(botUserId: string): KnownBlock[] {
  const bot = `<@${botUserId}>`;
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Keep your status page up to date from this channel.*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `• Mention ${bot} in a thread and describe what's happening: it drafts a status report from the conversation. Nothing is published until you approve it.`,
          "• Ask it to update or resolve a report, or to schedule a maintenance window.",
        ].join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Publish status update" },
          style: "primary",
          action_id: PUBLISH_STATUS_UPDATE_ACTION,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Only you can see this  ·  `/openstatus help` lists every command",
        },
      ],
    },
  ];
}
