import {
  and,
  db as defaultDb,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
} from "@openstatus/db";
import {
  INCIDENT_SLA_WARNING_RATIO,
  type Incident,
  type IncidentSlaNoticeKind,
  type IncidentSlaNoticeType,
  type IncidentUpdateCadence,
  type Workspace,
  incident,
  incidentEvent,
  incidentSlaNotice,
  incidentSlaState,
  incidentUpdateCadence,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import type { SlackConnection } from "../integration/slack-connection";
import {
  type ReminderTarget,
  isPermanentSlackError,
  loadWorkspaces,
  reminderConnection,
  reminderTarget,
} from "./reminders";
import type { IncidentSlaBreachRecord } from "./sla-breaches";
import { incidentSlaNoticeCopy } from "./sla-notice-copy";
import {
  type SlackClientFactory,
  type SlackIncidentBlock,
  escapeMrkdwn,
} from "./slack-flow";
import { loadIncidentUpdateActivity } from "./update-activity";
import type { IncidentMissedUpdateRecord } from "./update-misses";

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60_000;

export type DueIncidentSlaNotice = {
  incident: Incident;
  workspace: Workspace;
  kind: IncidentSlaNoticeKind;
  notice: IncidentSlaNoticeType;
  /** The interval for `update` notices. */
  targetMinutes: number;
  dueAt: Date;
};

/**
 * `sent`: a Slack message went out. `no_connection` / `no_target` / `refused`:
 * none did and none will (email may step in). `retry`: temporary failure, the
 * next tick tries again.
 */
export type IncidentSlaNoticeOutcome =
  | "sent"
  | "no_connection"
  | "no_target"
  | "refused"
  | "retry";

export type IncidentSlaNoticeResult = DueIncidentSlaNotice & {
  target: ReminderTarget | null;
  outcome: IncidentSlaNoticeOutcome;
};

const noticeKey = (n: {
  incident: { id: number };
  kind: string;
  notice: string;
  dueAt: Date;
}) => `${n.incident.id}:${n.kind}:${n.notice}:${n.dueAt.getTime()}`;

/**
 * Per interval: the due time of the running one when it is in its last quarter,
 * and of the newest elapsed one, so a long gap gives a single overdue notice.
 */
function updateNoticeDueTimes(cadence: IncidentUpdateCadence, now: Date) {
  const span = cadence.intervalMinutes * MINUTE;
  const start = cadence.startsAt.getTime();
  const elapsed = Math.max(0, Math.ceil((now.getTime() - start) / span) - 1);
  const warnAt = start + (elapsed + INCIDENT_SLA_WARNING_RATIO) * span;
  return {
    warning:
      now.getTime() >= warnAt ? new Date(start + (elapsed + 1) * span) : null,
    overdue: elapsed > 0 ? new Date(start + elapsed * span) : null,
  };
}

function stillUnmet(row: Incident, kind: "response" | "resolution") {
  if (row.closedAt || (row.status !== "open" && row.status !== "mitigated")) {
    return false;
  }
  return kind === "response"
    ? row.responseMetAt === null
    : row.resolutionStoppedAt === null;
}

/**
 * Unclaimed warnings and misses: misses this tick recorded plus unmet ones under a day old
 * (so a failed send is retried); an update miss only for the newest elapsed interval.
 */
export async function dueIncidentSlaNotices(args: {
  db: DB;
  now: Date;
  breaches: IncidentSlaBreachRecord[];
  missedUpdates?: IncidentMissedUpdateRecord[];
  workspaceIds?: number[];
}): Promise<DueIncidentSlaNotice[]> {
  const { db, now } = args;
  const due = new Map<string, DueIncidentSlaNotice>();
  // re-read: a meet landing after the stamp drops the notice, as on retry
  const stamped =
    args.breaches.length === 0
      ? new Map<number, Incident>()
      : new Map(
          (
            await db
              .select()
              .from(incident)
              .where(
                inArray(
                  incident.id,
                  args.breaches.map((b) => b.incident.id),
                ),
              )
              .all()
          ).map((row) => [row.id, row]),
        );
  for (const record of args.breaches) {
    const row = stamped.get(record.incident.id);
    if (!row || !stillUnmet(row, record.kind)) continue;
    const notice: DueIncidentSlaNotice = {
      incident: row,
      workspace: record.workspace,
      kind: record.kind,
      notice: "miss",
      targetMinutes: record.targetMinutes,
      dueAt: record.dueAt,
    };
    due.set(noticeKey(notice), notice);
  }

  const retryAfter = new Date(now.getTime() - DAY);
  const candidates =
    args.workspaceIds?.length === 0
      ? []
      : await db
          .select()
          .from(incident)
          .where(
            and(
              args.workspaceIds
                ? inArray(incident.workspaceId, args.workspaceIds)
                : undefined,
              inArray(incident.status, ["open", "mitigated"]),
              isNull(incident.closedAt),
              isNotNull(incident.slaSnapshot),
              or(
                and(
                  isNull(incident.responseMetAt),
                  or(
                    isNull(incident.responseBreachDueAt),
                    gt(incident.responseBreachDueAt, retryAfter),
                  ),
                ),
                and(
                  isNull(incident.resolutionStoppedAt),
                  or(
                    isNull(incident.resolutionBreachDueAt),
                    gt(incident.resolutionBreachDueAt, retryAfter),
                  ),
                ),
                isNull(incident.resolutionStoppedAt),
              ),
            ),
          )
          .all();
  const workspaces = await loadWorkspaces(db, [
    ...new Set(candidates.map((c) => c.workspaceId)),
  ]);
  const activity = await loadIncidentUpdateActivity(db, candidates);
  const missedKey = (incidentId: number, dueAt: Date) =>
    `${incidentId}:${dueAt.getTime()}`;
  const freshMisses = new Set(
    (args.missedUpdates ?? []).map((m) => missedKey(m.incident.id, m.dueAt)),
  );
  const recordedMisses =
    candidates.length === 0
      ? []
      : await db
          .select({
            incidentId: incidentEvent.incidentId,
            createdAt: incidentEvent.createdAt,
          })
          .from(incidentEvent)
          .where(
            and(
              inArray(
                incidentEvent.incidentId,
                candidates.map((c) => c.id),
              ),
              eq(incidentEvent.type, "sla_update_missed"),
              gt(incidentEvent.createdAt, retryAfter),
            ),
          )
          .all();
  const retryMisses = new Set(
    recordedMisses.map((m) => missedKey(m.incidentId, m.createdAt)),
  );

  for (const row of candidates) {
    const ws = workspaces.get(row.workspaceId);
    if (!ws) continue;
    const rowActivity = activity.get(row.id);
    const cadence = rowActivity
      ? incidentUpdateCadence(row, rowActivity, now)
      : null;
    if (cadence) {
      const { warning, overdue } = updateNoticeDueTimes(cadence, now);
      const items: DueIncidentSlaNotice[] = [];
      if (warning) {
        items.push({
          incident: row,
          workspace: ws,
          kind: "update",
          notice: "warning",
          targetMinutes: cadence.intervalMinutes,
          dueAt: warning,
        });
      }
      const key = overdue && missedKey(row.id, overdue);
      if (overdue && key && (freshMisses.has(key) || retryMisses.has(key))) {
        items.push({
          incident: row,
          workspace: ws,
          kind: "update",
          notice: "miss",
          targetMinutes: cadence.intervalMinutes,
          dueAt: overdue,
        });
      }
      for (const item of items) due.set(noticeKey(item), item);
    }

    const state = incidentSlaState(row, now);
    if (!state) continue;
    for (const kind of ["response", "resolution"] as const) {
      const timer = state[kind];
      if (!timer || timer.metAt) continue;
      const notice: IncidentSlaNoticeType | null =
        timer.status === "at_risk"
          ? "warning"
          : timer.breachDueAt && timer.breachDueAt > retryAfter
            ? "miss"
            : null;
      if (!notice) continue;
      const item = {
        incident: row,
        workspace: ws,
        kind,
        notice,
        targetMinutes: timer.targetMinutes,
        dueAt: timer.dueAt,
      };
      const key = noticeKey(item);
      if (!due.has(key)) due.set(key, item);
    }
  }
  if (due.size === 0) return [];

  const claimed = await db
    .select()
    .from(incidentSlaNotice)
    .where(
      and(
        inArray(incidentSlaNotice.incidentId, [
          ...new Set([...due.values()].map((d) => d.incident.id)),
        ]),
        eq(incidentSlaNotice.channel, "slack"),
      ),
    )
    .all();
  for (const row of claimed) {
    due.delete(noticeKey({ ...row, incident: { id: row.incidentId } }));
  }
  return [...due.values()];
}

async function claimNotice(
  db: DB,
  notice: DueIncidentSlaNotice,
): Promise<boolean> {
  const row = await db
    .insert(incidentSlaNotice)
    .values({
      incidentId: notice.incident.id,
      kind: notice.kind,
      notice: notice.notice,
      dueAt: notice.dueAt,
      channel: "slack",
    })
    .onConflictDoNothing()
    .returning({ id: incidentSlaNotice.id })
    .get();
  return row !== undefined;
}

async function releaseNotice(db: DB, notice: DueIncidentSlaNotice) {
  await db
    .delete(incidentSlaNotice)
    .where(
      and(
        eq(incidentSlaNotice.incidentId, notice.incident.id),
        eq(incidentSlaNotice.kind, notice.kind),
        eq(incidentSlaNotice.notice, notice.notice),
        eq(incidentSlaNotice.dueAt, notice.dueAt),
        eq(incidentSlaNotice.channel, "slack"),
      ),
    );
}

/** Action id of a notice's Acknowledge button, apart from the card's so a click redraws the notice. */
export const INCIDENT_SLA_NOTICE_ACKNOWLEDGE =
  "incident_sla_notice_acknowledge";
const NOTICE_OPEN = "incident_sla_notice_open";

/** What the Acknowledge button carries, so a click can redraw the notice it was on. */
export type IncidentSlaNoticeButtonValue = {
  incidentId: number;
  notice: IncidentSlaNoticeType;
  dueAt: number;
  targetMinutes: number;
  role?: "commander" | "declarer";
};

export function parseIncidentSlaNoticeButtonValue(
  value: string | undefined,
): IncidentSlaNoticeButtonValue | null {
  try {
    const parsed = JSON.parse(value ?? "");
    if (
      Number.isInteger(parsed?.incidentId) &&
      (parsed.notice === "warning" || parsed.notice === "miss") &&
      Number.isFinite(parsed.dueAt) &&
      Number.isInteger(parsed.targetMinutes)
    ) {
      return {
        incidentId: parsed.incidentId,
        notice: parsed.notice,
        dueAt: parsed.dueAt,
        targetMinutes: parsed.targetMinutes,
        role:
          parsed.role === "commander" || parsed.role === "declarer"
            ? parsed.role
            : undefined,
      };
    }
  } catch {}
  return null;
}

function slackTime(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000);
  return `<!date^${unix}^{date_short_pretty} at {time}|${date.toISOString()}>`;
}

/**
 * Block Kit of an SLA notice. Response notices carry an Acknowledge button in
 * acknowledgement mode until `acknowledgedBy` is given.
 */
export function incidentSlaNoticeBlocks(args: {
  incident: Pick<
    Incident,
    "id" | "title" | "severity" | "slaSnapshot" | "statusReportId"
  >;
  kind: IncidentSlaNoticeKind;
  notice: IncidentSlaNoticeType;
  targetMinutes: number;
  dueAt: Date;
  url: string;
  role?: "commander" | "declarer";
  acknowledgedBy?: string;
}): { text: string; blocks: SlackIncidentBlock[] } {
  const snapshot = args.incident.slaSnapshot;
  const responseMet = snapshot?.responseMet ?? "acknowledged";
  const copy = incidentSlaNoticeCopy(
    {
      kind: args.kind,
      notice: args.notice,
      title: args.incident.title,
      severity: args.incident.severity,
      targetMinutes: args.targetMinutes,
      dueAt: args.dueAt,
      responseMet,
      resolutionStop: snapshot?.resolutionStop ?? "mitigated",
      reportLinked: args.incident.statusReportId !== null,
    },
    { strong: (text) => `*${escapeMrkdwn(text)}*`, time: slackTime },
  );
  const icon =
    args.notice === "warning" ? ":hourglass_flowing_sand:" : ":rotating_light:";
  const lines = [`${icon} *${copy.headline}*`, copy.body];
  if (copy.action && !args.acknowledgedBy) lines.push(copy.action);
  const context = [
    ...(args.role ? [`You are the ${args.role} of this incident.`] : []),
    ...(args.acknowledgedBy
      ? [`:white_check_mark: Acknowledged by ${args.acknowledgedBy}`]
      : []),
  ];
  const acknowledge =
    args.kind === "response" &&
    responseMet === "acknowledged" &&
    !args.acknowledgedBy;
  const value: IncidentSlaNoticeButtonValue = {
    incidentId: args.incident.id,
    notice: args.notice,
    dueAt: args.dueAt.getTime(),
    targetMinutes: args.targetMinutes,
    ...(args.role ? { role: args.role } : {}),
  };
  return {
    text: `${copy.headline}: ${args.incident.title}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      ...(context.length > 0
        ? [
            {
              type: "context" as const,
              elements: context.map((text) => ({
                type: "mrkdwn" as const,
                text,
              })),
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          ...(acknowledge
            ? [
                {
                  type: "button" as const,
                  text: { type: "plain_text" as const, text: "Acknowledge" },
                  action_id: INCIDENT_SLA_NOTICE_ACKNOWLEDGE,
                  value: JSON.stringify(value),
                  style: "primary" as const,
                },
              ]
            : []),
          {
            type: "button",
            text: { type: "plain_text", text: "Open in openstatus" },
            url: args.url,
            action_id: NOTICE_OPEN,
          },
        ],
      },
    ],
  };
}

/**
 * Sends each due notice to Slack once: the bound channel, else a DM to the
 * commander, else to the declarer. Each notice is claimed by a write before
 * anything is sent, so it is safe on every machine at once.
 */
export async function sendIncidentSlaNotices(args: {
  breaches: IncidentSlaBreachRecord[];
  /** This tick's `recordIncidentMissedUpdates`, so a late record still notifies once. */
  missedUpdates?: IncidentMissedUpdateRecord[];
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  now?: Date;
  db?: DB;
  workspaceIds?: number[];
}): Promise<IncidentSlaNoticeResult[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const due = await dueIncidentSlaNotices({
    db,
    now,
    breaches: args.breaches,
    missedUpdates: args.missedUpdates,
    workspaceIds: args.workspaceIds,
  });

  const results: IncidentSlaNoticeResult[] = [];
  const connections = new Map<number, SlackConnection | null>();
  for (const item of due) {
    let claimed = false;
    try {
      claimed = await claimNotice(db, item);
      if (!claimed) continue;
      const wsId = item.workspace.id;
      if (!connections.has(wsId)) {
        connections.set(wsId, await reminderConnection(db, item.workspace));
      }
      const connection = connections.get(wsId);
      if (!connection) {
        results.push({ ...item, target: null, outcome: "no_connection" });
        continue;
      }
      const target = await reminderTarget(db, item.incident, connection);
      if (!target) {
        results.push({ ...item, target: null, outcome: "no_target" });
        continue;
      }
      const message = incidentSlaNoticeBlocks({
        ...item,
        url: `${args.dashboardUrl}/incidents/${item.incident.id}`,
        role: target.kind === "dm" ? target.role : undefined,
      });
      const outcome = await args
        .clientFor(connection.botToken)
        .chat.postMessage({
          channel:
            target.kind === "channel" ? target.channel : target.slackUserId,
          ...message,
        })
        .then(
          (): IncidentSlaNoticeOutcome => "sent",
          async (error): Promise<IncidentSlaNoticeOutcome> => {
            console.warn("incident sla notice failed", {
              incidentId: item.incident.id,
              kind: item.kind,
              notice: item.notice,
              error,
            });
            if (isPermanentSlackError(error)) return "refused";
            await releaseNotice(db, item);
            return "retry";
          },
        );
      results.push({ ...item, target, outcome });
    } catch (error) {
      console.warn("incident sla notice not sent", {
        incidentId: item.incident.id,
        kind: item.kind,
        notice: item.notice,
        error,
      });
      if (claimed) await releaseNotice(db, item).catch(() => undefined);
    }
  }
  return results;
}
