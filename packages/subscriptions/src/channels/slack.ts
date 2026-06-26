import { and, db, eq } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from "@slack/web-api";
import { WebClient } from "@slack/web-api";

import type { PageUpdate, Subscription } from "../types";
import { buildReplyMessage, buildRootMessage } from "./slack-blocks";
import {
  type SlackAnchorStore,
  createRedisAnchorStore,
} from "./slack-store";

interface SlackPostResult {
  ts?: string;
}

export interface SlackClient {
  postMessage(args: ChatPostMessageArguments): Promise<SlackPostResult>;
  update(args: ChatUpdateArguments): Promise<SlackPostResult>;
}

export interface SlackChannelDeps {
  store: SlackAnchorStore;
  createClient: (token: string) => SlackClient;
  getBotToken: (teamId: string) => Promise<string | null>;
  softUnsubscribe: (subscriberId: number) => Promise<void>;
}

// Errors that can never succeed on retry — the channel/app is gone, so we
// stop delivering to that subscriber instead of failing on every update.
const TERMINAL_SLACK_ERRORS = new Set([
  "channel_not_found",
  "is_archived",
  "channel_is_archived",
  "account_inactive",
  "token_revoked",
  "not_in_channel",
  "not_authed",
  "invalid_auth",
]);

// WebClient throws `WebAPIPlatformError` carrying `data.error`; this is the
// only place we reach into that SDK error shape.
function slackErrorCode(error: Error): string | undefined {
  const data = (error as Error & { data?: { error?: string } }).data;
  return typeof data?.error === "string" ? data.error : undefined;
}

function parseTeamId(channelConfig?: string): string | null {
  if (!channelConfig) return null;
  try {
    const parsed = JSON.parse(channelConfig) as { teamId?: string };
    return parsed.teamId ?? null;
  } catch {
    return null;
  }
}

async function getBotTokenFromDb(teamId: string): Promise<string | null> {
  const row = await db
    .select({ credential: integration.credential })
    .from(integration)
    .where(
      and(eq(integration.name, "slack-agent"), eq(integration.externalId, teamId)),
    )
    .get();
  const credential = row?.credential as { botToken?: string } | null;
  return credential?.botToken ?? null;
}

async function softUnsubscribeInDb(subscriberId: number): Promise<void> {
  await db
    .update(pageSubscriber)
    .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(pageSubscriber.id, subscriberId))
    .run();
}

export function createSlackChannel(deps: SlackChannelDeps) {
  async function runSlack(
    subscriberId: number,
    fn: () => Promise<SlackPostResult>,
  ): Promise<SlackPostResult | null> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) {
        const code = slackErrorCode(error);
        if (code && TERMINAL_SLACK_ERRORS.has(code)) {
          await deps.softUnsubscribe(subscriberId);
          console.error(
            `slack: terminal error '${code}' for subscriber ${subscriberId} — unsubscribed`,
          );
          return null;
        }
        console.error(
          `slack: delivery failed for subscriber ${subscriberId}: ${error.message}`,
        );
      } else {
        console.error(`slack: delivery failed for subscriber ${subscriberId}`);
      }
      return null;
    }
  }

  async function deliverMaintenance(
    client: SlackClient,
    sub: Subscription,
    channelId: string,
    pageUpdate: PageUpdate,
  ): Promise<void> {
    const root = buildRootMessage(pageUpdate, sub);
    await runSlack(sub.id, () =>
      client.postMessage({
        channel: channelId,
        text: root.text,
        attachments: root.attachments,
      }),
    );
  }

  async function deliverReport(
    client: SlackClient,
    sub: Subscription,
    channelId: string,
    pageUpdate: PageUpdate,
  ): Promise<void> {
    const reportId = pageUpdate.id;
    const updateId = pageUpdate.updateId;
    if (updateId == null) {
      console.error(`slack: status report update ${reportId} missing updateId`);
      return;
    }

    if (await deps.store.isDelivered(reportId, sub.id, updateId)) return;

    const anchor = await deps.store.getAnchor(reportId, sub.id);
    const root = buildRootMessage(pageUpdate, sub);

    if (!anchor) {
      const res = await runSlack(sub.id, () =>
        client.postMessage({
          channel: channelId,
          text: root.text,
          attachments: root.attachments,
        }),
      );
      if (!res) return;
      if (res.ts) {
        await deps.store.setAnchor(reportId, sub.id, { ts: res.ts, channelId });
      }
      await deps.store.markDelivered(reportId, sub.id, updateId);
      return;
    }

    const reply = buildReplyMessage(pageUpdate);
    const replyRes = await runSlack(sub.id, () =>
      client.postMessage({
        channel: channelId,
        thread_ts: anchor.ts,
        text: reply.text,
        blocks: reply.blocks,
      }),
    );
    if (!replyRes) return;
    await deps.store.markDelivered(reportId, sub.id, updateId);

    // Re-render the root so its emoji/status track the latest state.
    await runSlack(sub.id, () =>
      client.update({
        channel: channelId,
        ts: anchor.ts,
        text: root.text,
        attachments: root.attachments,
      }),
    );
  }

  async function sendNotifications(
    subscriptions: Subscription[],
    pageUpdate: PageUpdate,
  ): Promise<void> {
    const byTeam = new Map<string, { sub: Subscription; channelId: string }[]>();
    for (const sub of subscriptions) {
      if (sub.channelType !== "slack") continue;
      const channelId = sub.slackChannelId;
      const teamId = parseTeamId(sub.channelConfig);
      if (!channelId || !teamId) {
        console.error(`slack: subscriber ${sub.id} missing channelId/teamId`);
        continue;
      }
      const members = byTeam.get(teamId) ?? [];
      members.push({ sub, channelId });
      byTeam.set(teamId, members);
    }

    await Promise.allSettled(
      [...byTeam.entries()].map(async ([teamId, members]) => {
        const token = await deps.getBotToken(teamId);
        if (!token) {
          console.error(`slack: no bot token for team ${teamId}`);
          return;
        }
        const client = deps.createClient(token);
        await Promise.allSettled(
          members.map(({ sub, channelId }) =>
            pageUpdate.status === "maintenance"
              ? deliverMaintenance(client, sub, channelId, pageUpdate)
              : deliverReport(client, sub, channelId, pageUpdate),
          ),
        );
      }),
    );
  }

  return { sendNotifications };
}

const defaultChannel = createSlackChannel({
  store: createRedisAnchorStore(),
  createClient: (token) => {
    const web = new WebClient(token);
    return {
      postMessage: (args) => web.chat.postMessage(args),
      update: (args) => web.chat.update(args),
    };
  },
  getBotToken: getBotTokenFromDb,
  softUnsubscribe: softUnsubscribeInDb,
});

export async function sendSlackNotifications(
  subscriptions: Subscription[],
  pageUpdate: PageUpdate,
): Promise<void> {
  return defaultChannel.sendNotifications(subscriptions, pageUpdate);
}

export async function validateSlackConfig(
  config: unknown,
): Promise<{ valid: boolean; error?: string }> {
  if (
    config !== null &&
    typeof config === "object" &&
    "teamId" in config &&
    "channelId" in config
  ) {
    return { valid: true };
  }
  return { valid: false, error: "slack config requires teamId and channelId" };
}
