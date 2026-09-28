import { and, db as defaultDb, desc, eq, inArray } from "@openstatus/db";
import {
  type Incident,
  type IncidentSeverity,
  incident,
  incidentEvent,
  slackUser,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import { isFeatureEnabled } from "../features";
import { getSlackConnection } from "../integration/slack-connection";
import { INCIDENT_FEATURE } from "./internal";
import type { SlackClientFactory } from "./slack-flow";

const HOUR = 60 * 60 * 1000;

export const STALE_AFTER: Record<IncidentSeverity, number> = {
  critical: HOUR,
  major: 4 * HOUR,
  minor: 24 * HOUR,
};

/**
 * Which reminder window an incident is in: 0 once it's stale, then 1, 2, …
 * each twice as long as the last. `null` while it's still fresh.
 */
export function reminderWindow(
  severity: IncidentSeverity,
  lastActivity: Date,
  now: Date,
): number | null {
  const threshold = STALE_AFTER[severity];
  const elapsed = now.getTime() - lastActivity.getTime();
  if (elapsed < threshold) return null;
  return Math.floor(Math.log2(elapsed / threshold));
}

export type ReminderTarget =
  | { kind: "channel"; channel: string }
  | { kind: "dm"; slackUserId: string; role: "commander" | "declarer" };

export type ReminderResult = {
  incidentId: number;
  target: ReminderTarget | null;
};

/** `true` when this caller owns the key; used so each window fires once. */
export type ClaimOnce = (key: string, ttlSeconds: number) => Promise<boolean>;

async function dmTarget(
  db: DB,
  row: Incident,
  teamId: string,
): Promise<ReminderTarget | null> {
  for (const [role, userId] of [
    ["commander", row.commanderId],
    ["declarer", row.declaredBy],
  ] as const) {
    if (userId === null) continue;
    const mapping = await db
      .select({ slackUserId: slackUser.slackUserId })
      .from(slackUser)
      .where(
        and(
          eq(slackUser.workspaceId, row.workspaceId),
          eq(slackUser.slackTeamId, teamId),
          eq(slackUser.userId, userId),
        ),
      )
      .get();
    if (mapping) return { kind: "dm", slackUserId: mapping.slackUserId, role };
  }
  return null;
}

/**
 * Nudges open and mitigated incidents that went quiet: the bound channel,
 * else a DM to the commander, else to the declarer. Safe to run on every
 * machine at once: each window is claimed before anything is sent.
 */
export async function remindStaleIncidents(args: {
  now?: Date;
  clientFor: SlackClientFactory;
  claim: ClaimOnce;
  dashboardUrl: string;
  db?: DB;
}): Promise<ReminderResult[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const candidates = await db
    .select()
    .from(incident)
    .where(inArray(incident.status, ["open", "mitigated"]))
    .all();

  const results: ReminderResult[] = [];
  for (const row of candidates) {
    if (row.closedAt) continue;
    const workspaceRow = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, row.workspaceId))
      .get();
    const parsed = selectWorkspaceSchema.safeParse(workspaceRow);
    if (!parsed.success) continue;
    const ws = parsed.data;
    if (!isFeatureEnabled(ws, INCIDENT_FEATURE)) continue;
    if (!ws.limits["slack-agent"]) continue;

    const last = await db
      .select({ id: incidentEvent.id, createdAt: incidentEvent.createdAt })
      .from(incidentEvent)
      .where(eq(incidentEvent.incidentId, row.id))
      .orderBy(desc(incidentEvent.createdAt), desc(incidentEvent.id))
      .get();
    const lastActivity = last?.createdAt ?? row.declaredAt;
    const window = reminderWindow(row.severity, lastActivity, now);
    if (window === null) continue;

    const ctx: ServiceContext = {
      workspace: ws,
      actor: { type: "system", job: "incident-reminders" },
      db,
    };
    const connection = await getSlackConnection({ ctx });
    if (!connection) continue;

    const target: ReminderTarget | null =
      row.slackChannelId && row.slackTeamId === connection.teamId
        ? { kind: "channel", channel: row.slackChannelId }
        : await dmTarget(db, row, connection.teamId);
    if (!target) {
      console.warn("incident reminder skipped: nobody to remind", {
        incidentId: row.id,
      });
      results.push({ incidentId: row.id, target: null });
      continue;
    }

    const key = `incident:reminder:${row.id}:${last?.id ?? 0}:${window}`;
    if (!(await args.claim(key, 14 * 24 * 60 * 60))) continue;

    const quiet = Math.round((now.getTime() - lastActivity.getTime()) / HOUR);
    const url = `${args.dashboardUrl}/incidents/${row.id}`;
    const text =
      target.kind === "channel"
        ? `:hourglass: No update on *${row.title}* for ${quiet}h. Post a note, change its status, or resolve it. <${url}|Open in openstatus>`
        : `:hourglass: You are the ${target.role} of *${row.title}* (${row.severity}), which has had no update for ${quiet}h. <${url}|Open in openstatus>`;
    await args
      .clientFor(connection.botToken)
      .chat.postMessage({
        channel:
          target.kind === "channel" ? target.channel : target.slackUserId,
        text,
      })
      .catch((error) =>
        console.warn("incident reminder failed", { incidentId: row.id, error }),
      );
    results.push({ incidentId: row.id, target });
  }
  return results;
}
