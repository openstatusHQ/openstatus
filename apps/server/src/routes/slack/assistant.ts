import { getLogger } from "@logtape/logtape";
import type { KnownBlock, WebClient } from "@slack/web-api";

import { redis } from "@/libs/clients";

import { DOCS_URL } from "./home";

const logger = getLogger("api-server");

// Suggested prompts live in `features.agent_view.suggested_prompts` in
// slack-manifest.json. The agent experience renders them at the top of the
// Messages tab rather than inside a thread, so there is no runtime call to
// make and no second copy here to drift from the manifest.

/**
 * First contact. Short, because it sits above the manifest's prompt chips,
 * which already show what to ask for. It exists to say the one thing nobody
 * should have to discover by trying it: the agent drafts, and nothing reaches
 * the status page without a click.
 */
const WELCOME_TEXT =
  "I turn incident conversations into status page updates. I draft, you approve — nothing is published until you click Approve.";

const WELCOME_BLOCKS: KnownBlock[] = [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: "I turn incident conversations into status page updates.\n\nTell me what's happening, or mention *@openstatus* in a channel and I'll read the thread. *I draft, you approve* — nothing reaches your status page until you click *Approve*. I can also answer questions about your monitors and the openstatus docs.",
    },
  },
  {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Drafts are AI-generated — read them before approving. <${DOCS_URL}|Documentation>`,
      },
    ],
  },
];

/**
 * Whether this person has met the agent before. The agent experience has no
 * per-thread empty state to greet into — opening the Messages tab is the only
 * hook, and it fires every time — so the greeting is once per person.
 */
const GREETED_PREFIX = "slack:greeted:";
const GREETED_TTL_SECONDS = 365 * 24 * 60 * 60;

function greetedKey(teamId: string, userId: string): string {
  return `${GREETED_PREFIX}${teamId}:${userId}`;
}

export async function hasBeenGreeted(
  teamId: string,
  userId: string,
): Promise<boolean> {
  return (await redis.get(greetedKey(teamId, userId))) !== null;
}

/**
 * Greets someone the first time they open the agent, and never again.
 *
 * `threadTs` is set only on the legacy `assistant_thread_started` path, where
 * the greeting belongs in the thread that was just opened.
 */
export async function greetOnce(args: {
  slack: WebClient;
  teamId: string;
  userId: string;
  channel: string;
  threadTs?: string;
}): Promise<void> {
  const { slack, teamId, userId, channel, threadTs } = args;
  if (await hasBeenGreeted(teamId, userId)) return;

  await slack.chat.postMessage({
    channel,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: WELCOME_TEXT,
    blocks: WELCOME_BLOCKS,
  });

  await redis.set(greetedKey(teamId, userId), "1", {
    ex: GREETED_TTL_SECONDS,
  });
  logger.info("slack greeted user", { teamId, userId, channel });
}

// Slack clears the status as soon as the app posts in the thread, so there is
// no matching "clear" call on the success path. Superseded by
// `setSessionStatus` — kept for workspaces the agent session API rejects.
export async function setAssistantStatus(
  slack: WebClient,
  channel: string,
  threadTs: string,
  status: string,
): Promise<void> {
  await slack.assistant.threads.setStatus({
    channel_id: channel,
    thread_ts: threadTs,
    status,
  });
}

// Agent session lifecycle: `processing` shows the agent as working on the
// thread, `active` hands the turn back to the user. Works on thread-based
// sessions in channels and DMs; throws `feature_disabled` on workspaces where
// agent sessions aren't enabled.
export async function setSessionStatus(
  slack: WebClient,
  channel: string,
  threadTs: string,
  status: "processing" | "active",
  initiatorUserId?: string,
): Promise<void> {
  await slack.agents.sessions.setStatus({
    channel_id: channel,
    thread_ts: threadTs,
    status,
    initiator_user_id: initiatorUserId,
  });
}
