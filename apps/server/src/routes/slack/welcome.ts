import type { KnownBlock } from "@slack/web-api";

export const PUBLISH_STATUS_UPDATE_ACTION = "open_publish_status_update";
export const CATCH_UP_ACTION = "welcome_catch_up";

export const WELCOME_ACTIONS: ReadonlySet<string> = new Set([
  CATCH_UP_ACTION,
  PUBLISH_STATUS_UPDATE_ACTION,
]);

export const WELCOME_TEXT =
  "openstatus is in this channel. Catch up on it or publish a status update.";

export const CATCH_UP_REQUEST =
  "Catch me up: summarize what is happening in this channel. If it looks like an ongoing issue and no status report is open, draft one.";

export function buildWelcomeBlocks(botUserId: string): KnownBlock[] {
  const bot = `<@${botUserId}>`;
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*What do you want to do?*" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "• *Catch up on this channel*: I read the recent messages, summarize them, and draft a status report if something is going on.",
          "• *Publish status update*: tell your users on your status page.",
          `Or mention ${bot} in a thread anytime. Nothing is published until you approve it.`,
        ].join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Catch up on this channel" },
          style: "primary",
          action_id: CATCH_UP_ACTION,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Publish status update" },
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
