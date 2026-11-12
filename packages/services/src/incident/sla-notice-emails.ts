import { and, asc, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import {
  type IncidentSeverity,
  type IncidentSlaNoticeType,
  formatIncidentSlaMinutes,
  incidentEvent,
  incidentSlaNotice,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { incidentSlaNoticeCopy } from "./sla-notice-copy";
import type {
  IncidentSlaNoticeOutcome,
  IncidentSlaNoticeResult,
} from "./sla-notices";

/** Matches `sendIncidentSlaNotice` in `@openstatus/emails`, which the caller injects. */
export type IncidentSlaNoticeEmail = {
  to: string[];
  idempotencyKey: string;
  notice: IncidentSlaNoticeType;
  headline: string;
  body: string;
  action: string | null;
  incidentTitle: string;
  severity: IncidentSeverity;
  workspaceName: string;
  target: string;
  due: string;
  audience: "incident" | "workspace";
  url: string;
};

export type IncidentSlaNoticeEmailResult = {
  notice: IncidentSlaNoticeResult;
  to: string[];
  outcome: "sent" | "no_recipients" | "failed";
};

const UNDELIVERED: ReadonlySet<IncidentSlaNoticeOutcome> = new Set([
  "no_connection",
  "no_target",
  "refused",
]);

const dueFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

async function claimEmail(db: DB, n: IncidentSlaNoticeResult) {
  const row = await db
    .insert(incidentSlaNotice)
    .values({
      incidentId: n.incident.id,
      kind: n.kind,
      notice: n.notice,
      dueAt: n.dueAt,
      channel: "email",
    })
    .onConflictDoNothing()
    .returning({ id: incidentSlaNotice.id })
    .get();
  return row !== undefined;
}

/** The declaring user; none when an API key declared, whoever created the key. */
async function declarer(db: DB, n: IncidentSlaNoticeResult) {
  if (n.incident.declaredBy === null) return null;
  const declared = await db
    .select({ source: incidentEvent.source })
    .from(incidentEvent)
    .where(
      and(
        eq(incidentEvent.incidentId, n.incident.id),
        eq(incidentEvent.type, "declared"),
      ),
    )
    .get();
  return declared?.source === "api" ? null : n.incident.declaredBy;
}

/** Commander and declarer, else (neither set) the owners and admins; current members with an email only. */
async function recipients(db: DB, n: IncidentSlaNoticeResult) {
  const assigned = [n.incident.commanderId, await declarer(db, n)].filter(
    (id): id is number => id !== null,
  );
  const rows = await db
    .select({ id: user.id, email: user.email })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, n.workspace.id),
        isNull(user.deletedAt),
        assigned.length > 0
          ? inArray(user.id, assigned)
          : inArray(usersToWorkspaces.role, ["owner", "admin"]),
      ),
    )
    .orderBy(asc(user.id))
    .all();
  const byId = new Map(rows.map((r) => [r.id, r.email]));
  const ordered =
    assigned.length > 0
      ? assigned.map((id) => byId.get(id))
      : rows.map((r) => r.email);
  return {
    audience:
      assigned.length > 0 ? ("incident" as const) : ("workspace" as const),
    to: [...new Set(ordered.filter((e): e is string => !!e))],
  };
}

/**
 * Emails each notice Slack could not deliver, once: the `email` claim row is
 * written before sending, so it is safe on every machine at once.
 */
export async function emailIncidentSlaNotices(args: {
  notices: IncidentSlaNoticeResult[];
  send: (email: IncidentSlaNoticeEmail) => Promise<unknown>;
  dashboardUrl: string;
  db?: DB;
}): Promise<IncidentSlaNoticeEmailResult[]> {
  const db = args.db ?? defaultDb;
  const results: IncidentSlaNoticeEmailResult[] = [];
  for (const n of args.notices) {
    if (!UNDELIVERED.has(n.outcome)) continue;
    let to: string[] = [];
    try {
      if (!(await claimEmail(db, n))) continue;
      const found = await recipients(db, n);
      to = found.to;
      if (to.length === 0) {
        results.push({ notice: n, to, outcome: "no_recipients" });
        continue;
      }
      const snapshot = n.incident.slaSnapshot;
      const copy = incidentSlaNoticeCopy(
        {
          kind: n.kind,
          notice: n.notice,
          title: n.incident.title,
          severity: n.incident.severity,
          targetMinutes: n.targetMinutes,
          dueAt: n.dueAt,
          responseMet: snapshot?.responseMet ?? "acknowledged",
          resolutionStop: snapshot?.resolutionStop ?? "mitigated",
          reportLinked: n.incident.statusReportId !== null,
        },
        {
          strong: (text) => text,
          time: (date) => `${dueFormat.format(date)} UTC`,
        },
      );
      await args.send({
        to,
        idempotencyKey: `incident-sla-notice:${n.incident.id}:${n.kind}:${n.notice}:${n.dueAt.getTime()}`,
        notice: n.notice,
        ...copy,
        incidentTitle: n.incident.title,
        severity: n.incident.severity,
        workspaceName: n.workspace.name || n.workspace.slug,
        target:
          n.kind === "update"
            ? `every ${formatIncidentSlaMinutes(n.targetMinutes)}`
            : formatIncidentSlaMinutes(n.targetMinutes),
        due: `${dueFormat.format(n.dueAt)} UTC`,
        audience: found.audience,
        url: `${args.dashboardUrl}/incidents/${n.incident.id}`,
      });
      results.push({ notice: n, to, outcome: "sent" });
    } catch (error) {
      // The claim stays: a lost email beats a duplicate on the next tick.
      console.warn("incident sla notice email not sent", {
        incidentId: n.incident.id,
        kind: n.kind,
        notice: n.notice,
        error,
      });
      results.push({ notice: n, to, outcome: "failed" });
    }
  }
  return results;
}
