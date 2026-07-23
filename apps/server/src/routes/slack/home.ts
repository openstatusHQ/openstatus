import type { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/web-api";

const DOCS_URL = "https://www.openstatus.dev/docs";

export function buildHomeBlocks(): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "openstatus", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Manage incidents and status pages without leaving Slack. Mention *@openstatus* in any channel or thread and it drafts a status update from the conversation — nothing is published until you approve it.",
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: '*Create & update incidents*\nMention `@openstatus` describing the issue. It reads the thread, drafts a report, and you click *Approve*, *Approve & Notify*, or *Cancel*. Say _"we found the cause"_ or _"it\'s fixed"_ and it moves the incident to Identified or Resolved.',
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Slash commands*\n• `/openstatus subscribe <status-page-url>` — subscribe this channel to a status page\n• `/openstatus unsubscribe <status-page-url>` — unsubscribe this channel\n• `/openstatus subscriptions` — list this channel's subscriptions\n• `/openstatus help` — show these commands",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${DOCS_URL}|Documentation> · Updates from subscribed status pages appear as threaded messages in the channel.`,
        },
      ],
    },
  ];
}

export async function publishHomeView(
  slack: WebClient,
  userId: string,
): Promise<void> {
  await slack.views.publish({
    user_id: userId,
    view: { type: "home", blocks: buildHomeBlocks() },
  });
}
