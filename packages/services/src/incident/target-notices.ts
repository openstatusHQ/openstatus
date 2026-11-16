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
  type Incident,
  type IncidentTargetNoticeKind,
  type IncidentTargetNoticeType,
  type Workspace,
  incident,
  incidentTargetNotice,
  incidentTargetState,
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
import {
  type SlackClientFactory,
  type SlackIncidentBlock,
  escapeMrkdwn,
} from "./slack-flow";
import type { IncidentTargetBreachRecord } from "./target-breaches";
import { incidentTargetNoticeCopy } from "./target-notice-copy";

const DAY = 24 * 60 * 60 * 1000;

export type DueIncidentTargetNotice = {
  incident: Incident;
  workspace: Workspace;
  kind: IncidentTargetNoticeKind;
  notice: IncidentTargetNoticeType;
  targetMinutes: number;
  dueAt: Date;
};

/**
 * `sent`: a Slack message went out. `no_connection` / `no_target` / `refused`:
 * none did and none will (email may step in). `retry`: temporary failure, the
 * next tick tries again.
 */
export type IncidentTargetNoticeOutcome =
  | "sent"
  | "no_connection"
  | "no_target"
  | "refused"
  | "retry";

export type IncidentTargetNoticeResult = DueIncidentTargetNotice & {
  target: ReminderTarget | null;
  outcome: IncidentTargetNoticeOutcome;
};

const noticeKey = (n: {
  incident: { id: number };
  kind: string;
  notice: string;
  dueAt: Date;
}) => `${n.incident.id}:${n.kind}:${n.notice}:${n.dueAt.getTime()}`;

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
 * (so a failed send is retried).
 */
export async function dueIncidentTargetNotices(args: {
  db: DB;
  now: Date;
  breaches: IncidentTargetBreachRecord[];
  workspaceIds?: number[];
}): Promise<DueIncidentTargetNotice[]> {
  const { db, now } = args;
  const due = new Map<string, DueIncidentTargetNotice>();
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
    const notice: DueIncidentTargetNotice = {
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
              isNotNull(incident.targetSnapshot),
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
              ),
            ),
          )
          .all();
  const workspaces = await loadWorkspaces(db, [
    ...new Set(candidates.map((c) => c.workspaceId)),
  ]);

  for (const row of candidates) {
    const ws = workspaces.get(row.workspaceId);
    if (!ws) continue;
    const state = incidentTargetState(row, now);
    if (!state) continue;
    for (const kind of ["response", "resolution"] as const) {
      const timer = state[kind];
      if (!timer || timer.metAt) continue;
      const notice: IncidentTargetNoticeType | null =
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
    .from(incidentTargetNotice)
    .where(
      and(
        inArray(incidentTargetNotice.incidentId, [
          ...new Set([...due.values()].map((d) => d.incident.id)),
        ]),
        eq(incidentTargetNotice.channel, "slack"),
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
  notice: DueIncidentTargetNotice,
): Promise<boolean> {
  const row = await db
    .insert(incidentTargetNotice)
    .values({
      incidentId: notice.incident.id,
      kind: notice.kind,
      notice: notice.notice,
      dueAt: notice.dueAt,
      channel: "slack",
    })
    .onConflictDoNothing()
    .returning({ id: incidentTargetNotice.id })
    .get();
  return row !== undefined;
}

async function releaseNotice(db: DB, notice: DueIncidentTargetNotice) {
  await db
    .delete(incidentTargetNotice)
    .where(
      and(
        eq(incidentTargetNotice.incidentId, notice.incident.id),
        eq(incidentTargetNotice.kind, notice.kind),
        eq(incidentTargetNotice.notice, notice.notice),
        eq(incidentTargetNotice.dueAt, notice.dueAt),
        eq(incidentTargetNotice.channel, "slack"),
      ),
    );
}

/** Action id of a notice's Acknowledge button, apart from the card's so a click redraws the notice. */
export const INCIDENT_TARGET_NOTICE_ACKNOWLEDGE =
  "incident_target_notice_acknowledge";
const NOTICE_OPEN = "incident_target_notice_open";

/** What the Acknowledge button carries, so a click can redraw the notice it was on. */
export type IncidentTargetNoticeButtonValue = {
  incidentId: number;
  notice: IncidentTargetNoticeType;
  dueAt: number;
  targetMinutes: number;
  role?: "commander" | "declarer";
};

export function parseIncidentTargetNoticeButtonValue(
  value: string | undefined,
): IncidentTargetNoticeButtonValue | null {
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
 * Block Kit of a target notice. Response notices carry an Acknowledge button in
 * acknowledgement mode until `acknowledgedBy` is given.
 */
export function incidentTargetNoticeBlocks(args: {
  incident: Pick<Incident, "id" | "title" | "severity" | "targetSnapshot">;
  kind: IncidentTargetNoticeKind;
  notice: IncidentTargetNoticeType;
  targetMinutes: number;
  dueAt: Date;
  url: string;
  role?: "commander" | "declarer";
  acknowledgedBy?: string;
}): { text: string; blocks: SlackIncidentBlock[] } {
  const snapshot = args.incident.targetSnapshot;
  const responseMet = snapshot?.responseMet ?? "acknowledged";
  const copy = incidentTargetNoticeCopy(
    {
      kind: args.kind,
      notice: args.notice,
      title: args.incident.title,
      severity: args.incident.severity,
      targetMinutes: args.targetMinutes,
      dueAt: args.dueAt,
      responseMet,
      resolutionStop: snapshot?.resolutionStop ?? "mitigated",
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
  const value: IncidentTargetNoticeButtonValue = {
    incidentId: args.incident.id,
    notice: args.notice,
    dueAt: args.dueAt.getTime(),
    targetMinutes: args.targetMinutes,
    ...(args.role ? { role: args.role } : {}),
  };
  return {
    text: `${copy.headline}: ${escapeMrkdwn(args.incident.title)}`,
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
                  action_id: INCIDENT_TARGET_NOTICE_ACKNOWLEDGE,
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
export async function sendIncidentTargetNotices(args: {
  breaches: IncidentTargetBreachRecord[];
  clientFor: SlackClientFactory;
  dashboardUrl: string;
  now?: Date;
  db?: DB;
  workspaceIds?: number[];
}): Promise<IncidentTargetNoticeResult[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const due = await dueIncidentTargetNotices({
    db,
    now,
    breaches: args.breaches,
    workspaceIds: args.workspaceIds,
  });

  const results: IncidentTargetNoticeResult[] = [];
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
      const message = incidentTargetNoticeBlocks({
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
          (): IncidentTargetNoticeOutcome => "sent",
          async (error): Promise<IncidentTargetNoticeOutcome> => {
            console.warn("incident target notice failed", {
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
      console.warn("incident target notice not sent", {
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
