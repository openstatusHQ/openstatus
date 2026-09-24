import type { WebClient } from "@slack/web-api";

// Shown when a user opens a new thread in the agent pane. Slack caps a thread
// at four prompts; titles render as chips, `message` is what gets sent.
export const SUGGESTED_PROMPTS = [
  {
    title: "Create a status report",
    message:
      "We're seeing elevated errors on the API — create a status report.",
  },
  {
    title: "Open status reports",
    message: "Which status reports are currently open?",
  },
  {
    title: "Schedule maintenance",
    message: "Schedule a maintenance window next Tuesday from 2-3 PM UTC.",
  },
  {
    title: "Upcoming maintenance",
    message: "What maintenance windows are coming up?",
  },
];

export async function startAssistantThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
): Promise<void> {
  await slack.assistant.threads.setSuggestedPrompts({
    channel_id: channel,
    thread_ts: threadTs,
    title: "What do you need to communicate?",
    prompts: SUGGESTED_PROMPTS,
  });
}

// Slack clears the status as soon as the app posts in the thread, so there is
// no matching "clear" call on the success path.
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
