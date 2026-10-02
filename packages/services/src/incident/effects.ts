import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/db/src/schema";

import { displayName } from "../attribution";
import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";
import { userDisplayName } from "./internal";
import { getIncident } from "./list";
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

type EffectArgs = { ctx: ServiceContext; effects: IncidentEffects };

export function resolveDashboardUrl(env: {
  nodeEnv?: string;
  override?: string;
}): string {
  if (env.override) return env.override.replace(/\/+$/, "");
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

/** Best effort: a failed email never fails the mutation that assigned them. */
export async function notifyIncidentCommander(
  args: EffectArgs & { incidentId: number },
): Promise<void> {
  const { ctx, effects, incidentId } = args;
  try {
    const row = await getIncident({ ctx, input: { id: incidentId } });
    const commander = row?.commander;
    if (!row || !commander?.email) return;
    if (commander.id === tryGetActorUserId(ctx.actor)) return;
    await effects.sendCommanderEmail({
      to: commander.email,
      incidentTitle: row.title,
      severity: row.severity,
      workspaceName: ctx.workspace.name ?? ctx.workspace.slug,
      assignedBy: effects.assignedBy,
      url: incidentDashboardUrl(effects.dashboardUrl, row.id),
      idempotencyKey: `incident-commander:${row.id}:${commander.id}:${row.updatedAt.getTime()}`,
    });
  } catch (err) {
    console.warn("incident commander email failed", { incidentId, err });
  }
}

export async function afterIncidentDeclared(
  args: EffectArgs & {
    incident: Pick<Incident, "id" | "commanderId">;
    openSlackChannel: boolean;
  },
): Promise<OpenChannelResult | undefined> {
  const { ctx, effects, incident } = args;
  if (incident.commanderId !== null) {
    await notifyIncidentCommander({ ctx, effects, incidentId: incident.id });
  }
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
    await notifyIncidentCommander({ ctx, effects, incidentId: after.id });
    const fresh = await getIncident({ ctx, input: { id: after.id } });
    commanderName = fresh?.commander ? displayName(fresh.commander) : null;
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
