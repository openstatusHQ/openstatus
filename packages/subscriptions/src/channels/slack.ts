import { and, db, desc, eq } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from "@slack/web-api";
import { WebClient } from "@slack/web-api";

import type { PageUpdate, Subscription } from "../types";
import { buildReplyMessage, buildRootMessage } from "./slack-blocks";
import { type SlackAnchorStore, createRedisAnchorStore } from "./slack-store";

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

// Channel-scoped terminal errors: this subscriber's destination is gone for
// good, so we stop delivering to that one subscriber.
const CHANNEL_TERMINAL_ERRORS = new Set([
  "channel_not_found",
  "is_archived",
  "channel_is_archived",
]);

// Token-scoped errors: the team's bot token is invalid. This affects every
// subscriber on the team and is recoverable by reinstalling the app, so we
// abort the team's batch WITHOUT unsubscribing anyone — otherwise a broken
// token silently and permanently drops every subscription on the team.
const TOKEN_TERMINAL_ERRORS = new Set([
  "invalid_auth",
  "account_inactive",
  "token_revoked",
  "not_authed",
]);

// Returned by a delivery when the team token is invalid, signalling the caller
// to abort the remaining members of that team.
const TEAM_TOKEN_INVALID = Symbol("slack_team_token_invalid");
type DeliveryOutcome = typeof TEAM_TOKEN_INVALID | undefined;

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
      and(
        eq(integration.name, "slack-agent"),
        eq(integration.externalId, teamId),
      ),
    )
    // Slack keeps one live token per (app, team); a reinstall invalidates all
    // earlier ones. If the team is linked to several workspaces, the newest row
    // is the only one holding a valid token.
    .orderBy(desc(integration.updatedAt))
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
  ): Promise<SlackPostResult | null | typeof TEAM_TOKEN_INVALID> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) {
        const code = slackErrorCode(error);
        if (code && TOKEN_TERMINAL_ERRORS.has(code)) {
          return TEAM_TOKEN_INVALID;
        }
        if (code && CHANNEL_TERMINAL_ERRORS.has(code)) {
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
  ): Promise<DeliveryOutcome> {
    const root = buildRootMessage(pageUpdate, sub);
    const res = await runSlack(sub.id, () =>
      client.postMessage({
        channel: channelId,
        attachments: root.attachments,
      }),
    );
    if (res === TEAM_TOKEN_INVALID) return TEAM_TOKEN_INVALID;
  }

  async function deliverReport(
    client: SlackClient,
    sub: Subscription,
    channelId: string,
    pageUpdate: PageUpdate,
  ): Promise<DeliveryOutcome> {
    const reportId = pageUpdate.id;
    const updateId = pageUpdate.updateId;
    if (updateId == null) {
      console.error(`slack: status report update ${reportId} missing updateId`);
      return;
    }

    // Atomic dedupe: only the caller that wins this reservation posts. On a
    // failed post we release it below so the delivery stays retriable.
    if (!(await deps.store.reserveDelivery(reportId, sub.id, updateId))) return;

    const anchor = await deps.store.getAnchor(reportId, sub.id);
    const root = buildRootMessage(pageUpdate, sub);

    if (!anchor) {
      const res = await runSlack(sub.id, () =>
        client.postMessage({
          channel: channelId,
          attachments: root.attachments,
        }),
      );
      if (!res || res === TEAM_TOKEN_INVALID) {
        await deps.store.releaseDelivery(reportId, sub.id, updateId);
        return res === TEAM_TOKEN_INVALID ? TEAM_TOKEN_INVALID : undefined;
      }
      if (res.ts) {
        // Stash this first update so the next one can backfill it into the
        // thread before the root is re-rendered and its content lost.
        await deps.store.setAnchor(reportId, sub.id, {
          ts: res.ts,
          channelId,
          pendingRootReply: buildReplyMessage(pageUpdate),
        });
      }
      return;
    }

    // The first update only ever lived in the root. Before we overwrite the
    // root below, post it into the thread so its history is preserved.
    if (anchor.pendingRootReply) {
      const backfill = anchor.pendingRootReply;
      const backfillRes = await runSlack(sub.id, () =>
        client.postMessage({
          channel: anchor.channelId,
          thread_ts: anchor.ts,
          text: backfill.text,
          blocks: backfill.blocks,
        }),
      );
      if (!backfillRes || backfillRes === TEAM_TOKEN_INVALID) {
        await deps.store.releaseDelivery(reportId, sub.id, updateId);
        return backfillRes === TEAM_TOKEN_INVALID
          ? TEAM_TOKEN_INVALID
          : undefined;
      }
      // Clear before posting the current reply: if that reply fails and the
      // delivery is retried, the first update must not be backfilled twice.
      await deps.store.setAnchor(reportId, sub.id, {
        ts: anchor.ts,
        channelId: anchor.channelId,
      });
    }

    const reply = buildReplyMessage(pageUpdate);
    const replyRes = await runSlack(sub.id, () =>
      client.postMessage({
        channel: anchor.channelId,
        thread_ts: anchor.ts,
        text: reply.text,
        blocks: reply.blocks,
      }),
    );
    if (!replyRes || replyRes === TEAM_TOKEN_INVALID) {
      await deps.store.releaseDelivery(reportId, sub.id, updateId);
      return replyRes === TEAM_TOKEN_INVALID ? TEAM_TOKEN_INVALID : undefined;
    }

    // Re-render the root so its emoji/status track the latest state.
    const updateRes = await runSlack(sub.id, () =>
      client.update({
        channel: anchor.channelId,
        ts: anchor.ts,
        attachments: root.attachments,
      }),
    );
    if (updateRes === TEAM_TOKEN_INVALID) return TEAM_TOKEN_INVALID;
  }

  async function sendNotifications(
    subscriptions: Subscription[],
    pageUpdate: PageUpdate,
  ): Promise<void> {
    const byTeam = new Map<
      string,
      { sub: Subscription; channelId: string }[]
    >();
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
        // Sequential per team so a token failure aborts the batch before
        // hammering Slack with N calls that will all fail identically.
        for (const { sub, channelId } of members) {
          const outcome =
            pageUpdate.status === "maintenance"
              ? await deliverMaintenance(client, sub, channelId, pageUpdate)
              : await deliverReport(client, sub, channelId, pageUpdate);
          if (outcome === TEAM_TOKEN_INVALID) {
            console.error(
              `slack: team ${teamId} bot token invalid — aborting ${members.length} deliveries; subscribers left intact (reconnect the Slack app)`,
            );
            break;
          }
        }
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
    typeof (config as { teamId?: unknown }).teamId === "string" &&
    (config as { teamId: string }).teamId.length > 0 &&
    typeof (config as { channelId?: unknown }).channelId === "string" &&
    (config as { channelId: string }).channelId.length > 0
  ) {
    return { valid: true };
  }
  return { valid: false, error: "slack config requires teamId and channelId" };
}
