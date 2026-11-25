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

export const CHANNEL_INTRO_TEXT =
  "Hey, I'm openstatus. Mention me and I'll turn this channel's conversation into a status page update.";

/** Posted for the whole channel when someone adds the bot; the action card stays private. */
export function buildChannelIntroBlocks(botUserId: string): KnownBlock[] {
  const bot = `<@${botUserId}>`;
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:wave: Hey, I'm openstatus. Tag me with ${bot} and I'll turn what's being said here into a status page update, check on your monitors, or catch you up on the channel.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Try asking me*",
          "• " + bot + " `summarize this thread and draft a status report`",
          "• " + bot + " `are any of my monitors failing right now?`",
          "• " +
            bot +
            " `schedule maintenance on the API tomorrow from 2 to 3am UTC`",
        ].join("\n"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*A few things worth knowing*",
          "• I draft, you approve: nothing reaches your status page until someone clicks *Approve*.",
          "• Tag me again in the thread to keep going, and I'll pick up the conversation so far.",
          "• `/openstatus help` lists every command, including `/openstatus incident` to run an incident from Slack.",
        ].join("\n"),
      },
    },
  ];
}

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
