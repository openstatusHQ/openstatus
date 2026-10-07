import { and, eq, isNull } from "@openstatus/db";
import { type Incident, slackUser, user } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import {
  type SlackConnection,
  getSlackConnection,
} from "../integration/slack-connection";
import { createSlackUserMapping } from "../slack-user/create";
import { getIncidentInWorkspace } from "./internal";
import { bindIncidentSlackChannel } from "./slack-channel";

type SlackText = { type: "mrkdwn" | "plain_text"; text: string };
export type SlackIncidentBlock =
  | { type: "header"; text: SlackText }
  | { type: "section"; text: SlackText }
  | { type: "context"; elements: SlackText[] }
  | {
      type: "actions";
      elements: {
        type: "button";
        text: SlackText;
        url?: string;
        action_id: string;
        value?: string;
        style?: "primary" | "danger";
      }[];
    };

type SlackResult = { ok?: boolean; error?: string };

/** The Slack Web API calls the incident channel flow makes. `WebClient` fits. */
export type SlackIncidentClient = {
  conversations: {
    create(args: {
      name: string;
      is_private?: boolean;
    }): Promise<SlackResult & { channel?: { id?: string; name?: string } }>;
    invite(args: {
      channel: string;
      users: string;
      force?: boolean;
    }): Promise<SlackResult>;
    setTopic(args: { channel: string; topic: string }): Promise<SlackResult>;
    archive(args: { channel: string }): Promise<SlackResult>;
  };
  chat: {
    postMessage(args: {
      channel: string;
      text: string;
      blocks?: SlackIncidentBlock[];
    }): Promise<SlackResult & { ts?: string }>;
  };
  pins: {
    add(args: { channel: string; timestamp: string }): Promise<SlackResult>;
  };
  users: {
    lookupByEmail(args: {
      email: string;
    }): Promise<SlackResult & { user?: { id?: string } }>;
  };
};

export type SlackClientFactory = (botToken: string) => SlackIncidentClient;

const CHANNEL_NAME_MAX = 80;
const HEADER_TEXT_MAX = 150;
const SECTION_TEXT_MAX = 3000;

/** Escapes user text for mrkdwn so `<!channel>` or `<@U…>` never pings. */
export function escapeMrkdwn(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Escaped, then cut to `max` without leaving half an `&amp;` behind. */
function escapeTruncated(text: string, max: number): string {
  const escaped = escapeMrkdwn(text);
  if (escaped.length <= max) return escaped;
  return `${escaped.slice(0, max - 1).replace(/&[a-z]*$/, "")}…`;
}

/** `inc-YYYY-MM-DD-<slug>`, UTC date, within Slack's 80 chars and charset. */
export function incidentChannelName(
  incident: Pick<Incident, "title" | "declaredAt">,
  attempt = 1,
): string {
  const date = incident.declaredAt.toISOString().slice(0, 10);
  const suffix = attempt > 1 ? `-${attempt}` : "";
  const prefix = `inc-${date}-`;
  const slug = incident.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CHANNEL_NAME_MAX - prefix.length - suffix.length)
    .replace(/-+$/g, "");
  return `${prefix}${slug || "incident"}${suffix}`;
}

export function incidentTopic(
  incident: Pick<Incident, "severity" | "status">,
  url: string,
): string {
  return `${incident.severity.toUpperCase()} · ${incident.status} · ${url}`;
}

function errorCode(err: Error | string): string {
  if (typeof err === "string") return err;
  const data = "data" in err ? err.data : undefined;
  if (typeof data === "object" && data !== null && "error" in data) {
    return String(data.error);
  }
  return err.message;
}

/** Channel automation needs the plan and a fully-scoped install. */
export async function incidentSlackReady(
  ctx: ServiceContext,
): Promise<SlackConnection | null> {
  if (!ctx.workspace.limits["slack-agent"]) return null;
  const connection = await getSlackConnection({ ctx });
  if (!connection || connection.missingScopes.length > 0) return null;
  return connection;
}

/**
 * The Slack user who declared the incident: the clicking user when declared
 * from Slack, else the declarer's linked Slack account, else one found by
 * their openstatus email (and linked for next time).
 */
async function resolveDeclarerSlackId(
  ctx: ServiceContext,
  client: SlackIncidentClient,
  teamId: string,
  declaredBy: number | null,
): Promise<string | undefined> {
  if (ctx.actor.type === "slack" && ctx.actor.teamId === teamId) {
    return ctx.actor.slackUserId;
  }
  if (declaredBy === null) return undefined;
  const db = getReadDb(ctx);
  const linked = await db
    .select({ slackUserId: slackUser.slackUserId })
    .from(slackUser)
    .where(
      and(
        eq(slackUser.workspaceId, ctx.workspace.id),
        eq(slackUser.slackTeamId, teamId),
        eq(slackUser.userId, declaredBy),
      ),
    )
    .get();
  if (linked) return linked.slackUserId;

  const declarer = await db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.id, declaredBy), isNull(user.deletedAt)))
    .get();
  if (!declarer?.email) return undefined;
  try {
    const res = await client.users.lookupByEmail({ email: declarer.email });
    const slackUserId = res.user?.id;
    if (!slackUserId) return undefined;
    await createSlackUserMapping({
      ctx: {
        ...ctx,
        actor: { type: "system", job: "slack-incident-channel" },
      },
      input: { teamId, slackUserId, userId: declaredBy },
    });
    return slackUserId;
  } catch {
    // users_not_found: no Slack account with this email.
    return undefined;
  }
}

export type OpenChannelResult =
  | { status: "skipped" }
  | { status: "bound"; channelId: string }
  | { status: "unbound"; channelId: string; error: string }
  | { status: "failed"; error: string };

/**
 * Creates the incident's channel after the declare has committed: a Slack
 * failure never loses the incident. Order: create (retrying `name_taken`),
 * invite the declarer (others join themselves), topic, pinned header card,
 * bind. If binding fails twice the channel gets a "link this channel" card.
 */
export async function openIncidentSlackChannel(args: {
  ctx: ServiceContext;
  incidentId: number;
  clientFor: SlackClientFactory;
  dashboardUrl: string;
}): Promise<OpenChannelResult> {
  const { ctx, incidentId, clientFor, dashboardUrl } = args;
  const connection = await incidentSlackReady(ctx);
  if (!connection) return { status: "skipped" };
  const incident = await getIncidentInWorkspace(
    getReadDb(ctx),
    ctx.workspace.id,
    incidentId,
  );
  if (incident.slackChannelId || incident.closedAt)
    return { status: "skipped" };

  const client = clientFor(connection.botToken);
  const url = `${dashboardUrl}/incidents/${incident.id}`;

  let channelId: string | undefined;
  for (let attempt = 1; attempt <= 10 && !channelId; attempt++) {
    try {
      const res = await client.conversations.create({
        name: incidentChannelName(incident, attempt),
      });
      channelId = res.channel?.id;
    } catch (err) {
      const code = errorCode(err instanceof Error ? err : String(err));
      if (code !== "name_taken") return { status: "failed", error: code };
    }
  }
  if (!channelId) return { status: "failed", error: "name_taken" };

  try {
    const declarer = await resolveDeclarerSlackId(
      ctx,
      client,
      connection.teamId,
      incident.declaredBy,
    );
    if (declarer && declarer !== connection.botUserId) {
      await client.conversations
        .invite({ channel: channelId, users: declarer, force: true })
        .catch(() => undefined);
    }
    await client.conversations
      .setTopic({ channel: channelId, topic: incidentTopic(incident, url) })
      .catch(() => undefined);
    const header = await client.chat.postMessage({
      channel: channelId,
      text: `Incident: ${incident.title}`,
      blocks: headerBlocks(incident, url),
    });
    if (header.ts) {
      await client.pins
        .add({ channel: channelId, timestamp: header.ts })
        .catch(() => undefined);
    }
  } catch {
    // Invites, topic and card are cosmetic; binding is what matters.
  }

  const system: ServiceContext = {
    ...ctx,
    actor: { type: "system", job: "slack-incident-channel" },
  };
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await bindIncidentSlackChannel({
        ctx: system,
        input: { id: incident.id, teamId: connection.teamId, channelId },
      });
      return { status: "bound", channelId };
    } catch (err) {
      lastError = errorCode(err instanceof Error ? err : String(err));
    }
  }

  await client.chat
    .postMessage({
      channel: channelId,
      text: "This channel was created for an incident but could not be linked to it.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:warning: This channel was created for *${escapeTruncated(incident.title, 500)}* but could not be linked to it.`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Link this channel" },
              action_id: `incident_bind_${incident.id}`,
              value: channelId,
              style: "primary",
            },
          ],
        },
      ],
    })
    .catch(() => undefined);
  return { status: "unbound", channelId, error: lastError };
}

export function headerBlocks(
  incident: Pick<Incident, "title" | "severity" | "status" | "summary">,
  url: string,
): SlackIncidentBlock[] {
  const status = `*Severity:* ${incident.severity}   *Status:* ${incident.status}`;
  const summary = incident.summary
    ? `\n${escapeTruncated(incident.summary, SECTION_TEXT_MAX - status.length - 1)}`
    : "";
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: truncate(incident.title, HEADER_TEXT_MAX),
      },
    },
    { type: "section", text: { type: "mrkdwn", text: `${status}${summary}` } },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${url}|Open in openstatus> · Add a message to the timeline: ⋯ → *Add to incident timeline*, or react :pushpin:.`,
        },
      ],
    },
  ];
}

/** Topic refresh and a one-line message in the bound channel. Best effort. */
export async function announceIncidentChange(args: {
  ctx: ServiceContext;
  incidentId: number;
  text: string;
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  archive?: boolean;
}): Promise<void> {
  const { ctx, incidentId, text, clientFor, dashboardUrl } = args;
  try {
    const incident = await getIncidentInWorkspace(
      getReadDb(ctx),
      ctx.workspace.id,
      incidentId,
    );
    if (!incident.slackChannelId) return;
    await announceInChannel({
      ctx,
      incident,
      text,
      clientFor,
      dashboardUrl,
      archive: args.archive,
    });
  } catch {
    // The incident is the record; the channel is a courtesy.
  }
}

/** Same, for an incident row already in hand (e.g. just before deleting it). */
export async function announceInChannel(args: {
  ctx: ServiceContext;
  incident: Pick<
    Incident,
    "id" | "severity" | "status" | "slackChannelId" | "slackTeamId"
  >;
  text: string;
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  archive?: boolean;
}): Promise<void> {
  const { ctx, incident, text, clientFor, dashboardUrl } = args;
  const channel = incident.slackChannelId;
  if (!channel) return;
  try {
    const connection = await getSlackConnection({ ctx });
    if (!connection || connection.teamId !== incident.slackTeamId) return;
    const client = clientFor(connection.botToken);
    const url = `${dashboardUrl}/incidents/${incident.id}`;
    await client.chat.postMessage({ channel, text }).catch(() => undefined);
    if (args.archive) {
      await client.conversations.archive({ channel }).catch(() => undefined);
      return;
    }
    await client.conversations
      .setTopic({ channel, topic: incidentTopic(incident, url) })
      .catch(() => undefined);
  } catch {
    // Best effort.
  }
}
