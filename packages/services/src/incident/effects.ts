import { and, desc, eq, inArray } from "@openstatus/db";
import {
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  incidentEvent,
  user,
} from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";
import { userDisplayName } from "./internal";
import {
  type OpenChannelResult,
  type SlackClientFactory,
  announceInChannel,
  announceIncidentChange,
  escapeMrkdwn,
  openIncidentSlackChannel,
} from "./slack-flow";

export type CommanderEmail = {
  to: string;
  incidentTitle: string;
  severity: IncidentSeverity;
  workspaceName: string;
  assignedBy: string;
  url: string;
  idempotencyKey: string;
};

/** What an adapter supplies so every surface runs the same follow-ups. */
export type IncidentEffects = {
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  sendCommanderEmail: (email: CommanderEmail) => Promise<unknown>;
  /** Slack mrkdwn naming the actor in channel messages. */
  actorLabel: string;
  /** Plain name shown as "assigned by" in the commander email. */
  assignedBy: string;
};

/**
 * Effects for an actor named `name`. Channel messages get the name escaped
 * for mrkdwn unless `actorLabel` overrides it (e.g. a Slack `<@U…>` mention);
 * the email gets it verbatim.
 */
export function incidentEffects(args: {
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  sendCommanderEmail: IncidentEffects["sendCommanderEmail"];
  name: string;
  actorLabel?: string;
}): IncidentEffects {
  const { name, actorLabel, ...deps } = args;
  return {
    ...deps,
    actorLabel: actorLabel ?? escapeMrkdwn(name),
    assignedBy: name,
  };
}

type EffectArgs = { ctx: ServiceContext; effects: IncidentEffects };

export function resolveDashboardUrl(env: {
  nodeEnv?: string;
  override?: string;
}): string {
  if (env.override) {
    // a loop, not /\/+$/: that regex backtracks quadratically on many slashes
    let end = env.override.length;
    while (end > 0 && env.override[end - 1] === "/") end--;
    return env.override.slice(0, end);
  }
  return env.nodeEnv === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3001";
}

export function incidentDashboardUrl(
  dashboardUrl: string,
  incidentId: number,
): string {
  return `${dashboardUrl}/incidents/${incidentId}`;
}

export async function actorDisplayName(
  ctx: ServiceContext,
): Promise<string | null> {
  return userDisplayName(getReadDb(ctx), tryGetActorUserId(ctx.actor));
}

export function quoteNote(note: string | undefined): string {
  return note ? `\n>${escapeMrkdwn(note).replaceAll("\n", "\n>")}` : "";
}

type CommanderSnapshot = Pick<
  Incident,
  "id" | "title" | "severity" | "commanderId"
>;

/**
 * Best effort: a failed email never fails the mutation that assigned them.
 * Reads the recipient from the mutation's own snapshot, never a reload, so an
 * overlapping reassignment can't redirect this email to the later commander.
 */
export async function notifyIncidentCommander(
  args: EffectArgs & { incident: CommanderSnapshot },
): Promise<void> {
  const { ctx, effects, incident } = args;
  const commanderId = incident.commanderId;
  if (commanderId === null) return;
  if (commanderId === tryGetActorUserId(ctx.actor)) return;
  try {
    const db = getReadDb(ctx);
    const commander = await db
      .select({ email: user.email, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, commanderId))
      .get();
    if (!commander?.email || commander.deletedAt) return;
    // Each assignment writes its own event, so its id is unique per
    // assignment yet stable if this effect is retried.
    const assignment = await db
      .select({ id: incidentEvent.id })
      .from(incidentEvent)
      .where(
        and(
          eq(incidentEvent.incidentId, incident.id),
          inArray(incidentEvent.type, ["declared", "commander_changed"]),
        ),
      )
      .orderBy(desc(incidentEvent.id))
      .get();
    await effects.sendCommanderEmail({
      to: commander.email,
      incidentTitle: incident.title,
      severity: incident.severity,
      workspaceName: ctx.workspace.name ?? ctx.workspace.slug,
      assignedBy: effects.assignedBy,
      url: incidentDashboardUrl(effects.dashboardUrl, incident.id),
      idempotencyKey: `incident-commander:${incident.id}:${commanderId}:${assignment?.id ?? 0}`,
    });
  } catch (err) {
    console.warn("incident commander email failed", {
      incidentId: incident.id,
      err,
    });
  }
}

export async function afterIncidentDeclared(
  args: EffectArgs & {
    incident: CommanderSnapshot;
    openSlackChannel: boolean;
  },
): Promise<OpenChannelResult | undefined> {
  const { ctx, effects, incident } = args;
  await notifyIncidentCommander({ ctx, effects, incident });
  if (!args.openSlackChannel) return undefined;
  return openIncidentSlackChannel({
    ctx,
    incidentId: incident.id,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
  });
}

type ChangeFields = Pick<
  Incident,
  "title" | "summary" | "startedAt" | "severity" | "commanderId"
>;

export function describeIncidentChanges(
  before: ChangeFields,
  after: ChangeFields,
  commanderName: string | null,
): string[] {
  const changes: string[] = [];
  if (after.title !== before.title) {
    changes.push(`title is now *${escapeMrkdwn(after.title)}*`);
  }
  if (after.summary !== before.summary) {
    changes.push(after.summary ? "summary was updated" : "summary was removed");
  }
  if (after.startedAt.getTime() !== before.startedAt.getTime()) {
    const seconds = Math.floor(after.startedAt.getTime() / 1000);
    changes.push(
      `start time is now <!date^${seconds}^{date_short_pretty} {time}|${after.startedAt.toISOString()}>`,
    );
  }
  if (after.severity !== before.severity) {
    changes.push(`severity is now *${after.severity}*`);
  }
  if (after.commanderId !== before.commanderId) {
    changes.push(
      commanderName
        ? `${escapeMrkdwn(commanderName)} is now commander`
        : "there is no commander",
    );
  }
  return changes;
}

export async function afterIncidentUpdated(
  args: EffectArgs & { before: ChangeFields; after: Incident },
): Promise<void> {
  const { ctx, effects, before, after } = args;
  const commanderChanged = after.commanderId !== before.commanderId;
  let commanderName: string | null = null;
  if (commanderChanged && after.commanderId !== null) {
    await notifyIncidentCommander({ ctx, effects, incident: after });
    commanderName = await userDisplayName(getReadDb(ctx), after.commanderId);
  }
  const changes = describeIncidentChanges(before, after, commanderName);
  if (!changes.length) return;
  await announceIncidentChange({
    ctx,
    incidentId: after.id,
    text: `${effects.actorLabel}: ${changes.join(", ")}.`,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
  });
}

export async function afterIncidentStatusChanged(
  args: EffectArgs & {
    incidentId: number;
    status: IncidentStatus;
    note?: string;
    archive?: boolean;
  },
): Promise<void> {
  const { ctx, effects, status } = args;
  await announceIncidentChange({
    ctx,
    incidentId: args.incidentId,
    text: `${effects.actorLabel} marked the incident *${status}*.${quoteNote(args.note)}`,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
    archive: args.archive ?? status === "canceled",
  });
}

export async function afterIncidentClosed(
  args: EffectArgs & { incidentId: number },
): Promise<void> {
  const { ctx, effects } = args;
  await announceIncidentChange({
    ctx,
    incidentId: args.incidentId,
    text: `${effects.actorLabel} closed the incident.`,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
    archive: true,
  });
}

export async function afterPostmortemApproved(
  args: EffectArgs & { incidentId: number; closed: boolean },
): Promise<void> {
  const { ctx, effects, closed } = args;
  await announceIncidentChange({
    ctx,
    incidentId: args.incidentId,
    text: closed
      ? `${effects.actorLabel} approved the postmortem and closed the incident.`
      : `${effects.actorLabel} approved the postmortem.`,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
    archive: closed,
  });
}

export async function afterIncidentDeleted(
  args: EffectArgs & {
    before: Pick<
      Incident,
      "id" | "severity" | "status" | "slackChannelId" | "slackTeamId"
    >;
  },
): Promise<void> {
  const { ctx, effects, before } = args;
  if (!before.slackChannelId) return;
  await announceInChannel({
    ctx,
    incident: before,
    text: `${effects.actorLabel} deleted this incident: it was declared by mistake.`,
    clientFor: effects.clientFor,
    dashboardUrl: effects.dashboardUrl,
    archive: true,
  });
}
