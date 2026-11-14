import {
  and,
  db as defaultDb,
  desc,
  eq,
  inArray,
  notInArray,
} from "@openstatus/db";
import {
  type Incident,
  type IncidentSeverity,
  type Workspace,
  incident,
  incidentEvent,
  incidentSystemEventTypes,
  incidentUpdateCadence,
  slackUser,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import {
  type SlackConnection,
  getSlackConnection,
} from "../integration/slack-connection";
import type { SlackClientFactory } from "./slack-flow";
import { loadIncidentUpdateActivity } from "./update-activity";

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
  /** `false` when there was nobody to remind or Slack rejected the post. */
  sent: boolean;
};

/** `true` when this caller owns the key; used so each window fires once. */
export type ClaimOnce = (key: string, ttlSeconds: number) => Promise<boolean>;
export type ReleaseClaim = (key: string) => Promise<void>;

export type DueReminder = {
  incident: Incident;
  lastActivity: Date;
  /** Claim key, unique per incident, last event and window. */
  key: string;
};

// The Slack client already retries network, 5xx and 429 errors; anything else
// (channel_not_found, not_in_channel, …) would fail again on the next tick.
export function isPermanentSlackError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "slack_webapi_platform_error"
  );
}

/**
 * Open and mitigated incidents that went quiet, regardless of delivery. An
 * active update cadence replaces this reminder; system events are not activity.
 */
export async function dueStaleReminders(args: {
  db: DB;
  now: Date;
}): Promise<DueReminder[]> {
  const candidates = (
    await args.db
      .select()
      .from(incident)
      .where(inArray(incident.status, ["open", "mitigated"]))
      .all()
  ).filter((row) => !row.closedAt);
  const activity = await loadIncidentUpdateActivity(
    args.db,
    candidates.filter((row) => row.slaSnapshot),
  );

  const due: DueReminder[] = [];
  for (const row of candidates) {
    const rowActivity = activity.get(row.id);
    if (rowActivity && incidentUpdateCadence(row, rowActivity, args.now)) {
      continue;
    }
    const last = await args.db
      .select({ id: incidentEvent.id, createdAt: incidentEvent.createdAt })
      .from(incidentEvent)
      .where(
        and(
          eq(incidentEvent.incidentId, row.id),
          notInArray(incidentEvent.type, [...incidentSystemEventTypes]),
        ),
      )
      .orderBy(desc(incidentEvent.createdAt), desc(incidentEvent.id))
      .get();
    const lastActivity = last?.createdAt ?? row.declaredAt;
    const window = reminderWindow(row.severity, lastActivity, args.now);
    if (window === null) continue;
    due.push({
      incident: row,
      lastActivity,
      key: `incident:reminder:${row.id}:${last?.id ?? 0}:${window}`,
    });
  }
  return due;
}

export async function loadWorkspaces(
  db: DB,
  ids: number[],
): Promise<Map<number, Workspace>> {
  const workspaces = new Map<number, Workspace>();
  if (ids.length === 0) return workspaces;
  const rows = await db
    .select()
    .from(workspace)
    .where(inArray(workspace.id, ids))
    .all();
  for (const row of rows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (parsed.success) workspaces.set(parsed.data.id, parsed.data);
  }
  return workspaces;
}

export async function reminderConnection(
  db: DB,
  ws: Workspace | undefined,
): Promise<SlackConnection | null> {
  if (!ws?.limits["slack-agent"]) return null;
  const ctx: ServiceContext = {
    workspace: ws,
    actor: { type: "system", job: "incident-reminders" },
    db,
  };
  const connection = await getSlackConnection({ ctx });
  if (!connection || connection.missingScopes.includes("chat:write")) {
    return null;
  }
  return connection;
}

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

export async function reminderTarget(
  db: DB,
  row: Incident,
  connection: SlackConnection,
): Promise<ReminderTarget | null> {
  if (row.slackChannelId && row.slackTeamId === connection.teamId) {
    return { kind: "channel", channel: row.slackChannelId };
  }
  return dmTarget(db, row, connection.teamId);
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
  release: ReleaseClaim;
  dashboardUrl: string;
  db?: DB;
}): Promise<ReminderResult[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const due = await dueStaleReminders({ db, now });
  const workspaces = await loadWorkspaces(db, [
    ...new Set(due.map((d) => d.incident.workspaceId)),
  ]);

  const results: ReminderResult[] = [];
  const connections = new Map<number, SlackConnection | null>();
  for (const { incident: row, lastActivity, key } of due) {
    if (!connections.has(row.workspaceId)) {
      connections.set(
        row.workspaceId,
        await reminderConnection(db, workspaces.get(row.workspaceId)),
      );
    }
    const connection = connections.get(row.workspaceId);
    if (!connection) continue;

    // Claimed before resolving the target so a skip is reported once per window.
    if (!(await args.claim(key, 14 * 24 * 60 * 60))) continue;

    const target = await reminderTarget(db, row, connection);
    if (!target) {
      console.warn("incident reminder skipped: nobody to remind", {
        incidentId: row.id,
      });
      results.push({ incidentId: row.id, target: null, sent: false });
      continue;
    }

    const quiet = Math.round((now.getTime() - lastActivity.getTime()) / HOUR);
    const url = `${args.dashboardUrl}/incidents/${row.id}`;
    const text =
      target.kind === "channel"
        ? `:hourglass: No update on *${row.title}* for ${quiet}h. Post a note, change its status, or resolve it. <${url}|Open in openstatus>`
        : `:hourglass: You are the ${target.role} of *${row.title}* (${row.severity}), which has had no update for ${quiet}h. <${url}|Open in openstatus>`;
    const sent = await args
      .clientFor(connection.botToken)
      .chat.postMessage({
        channel:
          target.kind === "channel" ? target.channel : target.slackUserId,
        text,
      })
      .then(
        () => true,
        async (error) => {
          console.warn("incident reminder failed", {
            incidentId: row.id,
            error,
          });
          if (!isPermanentSlackError(error)) await args.release(key);
          return false;
        },
      );
    results.push({ incidentId: row.id, target, sent });
  }
  return results;
}
