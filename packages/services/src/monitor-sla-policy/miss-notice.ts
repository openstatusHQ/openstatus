import { and, asc, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorSlaMissNotice,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { monthRange } from "../frozen-uptime/compute";
import { FREEZE_CUTOFF_MS } from "../frozen-uptime/run";
import { withBusyRetry } from "../retry";

const DAY_MS = 86_400_000;

export type MonitorSlaMissNotice = {
  month: string;
  workspaceId: number;
  workspaceName: string;
  /** workspace owners */
  to: string[];
  policy: { id: number; name: string; target: number };
  /** sealed misses of current members, by monitor id */
  monitors: { id: number; name: string; uptime: number; target: number }[];
};

/**
 * Claims the "missed target" email for every policy with a sealed miss in `month` and none yet,
 * once no member waits to be sealed (or on the seal window's last day). The claim row is the
 * arbiter, so overlapping runs send it once. No audit row: a system job, like the seal.
 */
export async function claimMonitorSlaMissNotices(args: {
  db?: DB;
  month: string;
  now?: Date;
  policyIds?: number[];
  /** policies the seal run left pairs unsealed for because their counts could not be read */
  unavailablePolicyIds?: readonly number[];
}): Promise<MonitorSlaMissNotice[]> {
  const db = args.db ?? defaultDb;
  const { month } = args;
  const now = (args.now ?? new Date()).getTime();
  if (args.policyIds?.length === 0) return [];

  const misses = await withBusyRetry(() =>
    db
      .select({
        policyId: monitorSlaPolicy.id,
        policyName: monitorSlaPolicy.name,
        policyTarget: monitorSlaPolicy.target,
        timeZone: monitorSlaPolicy.timeZone,
        workspaceId: monitorSlaPolicy.workspaceId,
        monitorId: monitor.id,
        monitorName: monitor.name,
        uptime: monitorSlaSealedMonth.uptime,
        target: monitorSlaSealedMonth.target,
      })
      .from(monitorSlaSealedMonth)
      .innerJoin(
        monitorSlaPolicy,
        eq(monitorSlaPolicy.id, monitorSlaSealedMonth.monitorSlaPolicyId),
      )
      .innerJoin(
        monitorSlaPolicyToMonitor,
        and(
          eq(
            monitorSlaPolicyToMonitor.monitorSlaPolicyId,
            monitorSlaSealedMonth.monitorSlaPolicyId,
          ),
          eq(
            monitorSlaPolicyToMonitor.monitorId,
            monitorSlaSealedMonth.monitorId,
          ),
        ),
      )
      .innerJoin(monitor, eq(monitor.id, monitorSlaSealedMonth.monitorId))
      .leftJoin(
        monitorSlaMissNotice,
        and(
          eq(monitorSlaMissNotice.monitorSlaPolicyId, monitorSlaPolicy.id),
          eq(monitorSlaMissNotice.month, month),
        ),
      )
      .where(
        and(
          args.policyIds
            ? inArray(monitorSlaPolicy.id, args.policyIds)
            : undefined,
          eq(monitorSlaSealedMonth.month, month),
          eq(monitorSlaSealedMonth.met, false),
          isNull(monitorSlaPolicy.archivedAt),
          isNull(monitor.deletedAt),
          isNull(monitorSlaMissNotice.monitorSlaPolicyId),
        ),
      )
      .orderBy(asc(monitorSlaPolicy.id), asc(monitor.id))
      .all(),
  );
  if (misses.length === 0) return [];

  const byPolicy = new Map<number, typeof misses>();
  for (const m of misses) {
    const list = byPolicy.get(m.policyId) ?? [];
    list.push(m);
    byPolicy.set(m.policyId, list);
  }

  // the last daily run inside the seal window sends with what is sealed
  const lastSealRun = (timeZone: string) =>
    now >= monthRange(month, timeZone).start + FREEZE_CUTOFF_MS - DAY_MS;
  const waiting = await policiesAwaitingSeal({
    db,
    month,
    policyIds: [...byPolicy]
      .filter(([, rows]) => !lastSealRun(rows[0].timeZone))
      .map(([id]) => id),
    unavailablePolicyIds: args.unavailablePolicyIds ?? [],
  });

  const claimed: (typeof misses)[] = [];
  for (const [policyId, rows] of byPolicy) {
    if (waiting.has(policyId)) continue;
    const won = await withBusyRetry(() =>
      db
        .insert(monitorSlaMissNotice)
        .values({
          monitorSlaPolicyId: policyId,
          workspaceId: rows[0].workspaceId,
          month,
        })
        .onConflictDoNothing()
        .returning({ policyId: monitorSlaMissNotice.monitorSlaPolicyId }),
    );
    if (won.length > 0) claimed.push(rows);
  }
  if (claimed.length === 0) return [];

  const workspaceIds = Array.from(
    new Set(claimed.map((r) => r[0].workspaceId)),
  );
  const [workspaces, owners] = await Promise.all([
    withBusyRetry(() =>
      db
        .select({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        })
        .from(workspace)
        .where(inArray(workspace.id, workspaceIds))
        .all(),
    ),
    withBusyRetry(() =>
      db
        .select({
          workspaceId: usersToWorkspaces.workspaceId,
          email: user.email,
        })
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .where(
          and(
            inArray(usersToWorkspaces.workspaceId, workspaceIds),
            eq(usersToWorkspaces.role, "owner"),
            isNull(user.deletedAt),
          ),
        )
        .orderBy(asc(user.id))
        .all(),
    ),
  ]);

  return claimed.map((rows) => {
    const first = rows[0];
    const ws = workspaces.find((w) => w.id === first.workspaceId);
    return {
      month,
      workspaceId: first.workspaceId,
      workspaceName: ws?.name || ws?.slug || "",
      to: owners.flatMap((o) =>
        o.workspaceId === first.workspaceId && o.email ? [o.email] : [],
      ),
      policy: {
        id: first.policyId,
        name: first.policyName,
        target: first.policyTarget,
      },
      monitors: rows.flatMap((r) =>
        r.uptime === null
          ? []
          : [
              {
                id: r.monitorId,
                name: r.monitorName,
                uptime: r.uptime,
                target: r.target,
              },
            ],
      ),
    };
  });
}

/** Policies with a member whose month may still seal: episodes unreadable, or not sealed yet. */
async function policiesAwaitingSeal(args: {
  db: DB;
  month: string;
  policyIds: number[];
  unavailablePolicyIds: readonly number[];
}): Promise<Set<number>> {
  const { db, month } = args;
  const waiting = new Set(
    args.policyIds.filter((id) => args.unavailablePolicyIds.includes(id)),
  );
  const open = args.policyIds.filter((id) => !waiting.has(id));
  if (open.length === 0) return waiting;
  const unsealed = await withBusyRetry(() =>
    db
      .select({
        policyId: monitorSlaPolicyToMonitor.monitorSlaPolicyId,
        timeZone: monitorSlaPolicy.timeZone,
        joinedAt: monitorSlaPolicyToMonitor.createdAt,
      })
      .from(monitorSlaPolicyToMonitor)
      .innerJoin(
        monitorSlaPolicy,
        eq(monitorSlaPolicy.id, monitorSlaPolicyToMonitor.monitorSlaPolicyId),
      )
      .innerJoin(monitor, eq(monitor.id, monitorSlaPolicyToMonitor.monitorId))
      .leftJoin(
        monitorSlaSealedMonth,
        and(
          eq(
            monitorSlaSealedMonth.monitorSlaPolicyId,
            monitorSlaPolicyToMonitor.monitorSlaPolicyId,
          ),
          eq(monitorSlaSealedMonth.monitorId, monitor.id),
          eq(monitorSlaSealedMonth.month, month),
        ),
      )
      .where(
        and(
          inArray(monitorSlaPolicyToMonitor.monitorSlaPolicyId, open),
          isNull(monitor.deletedAt),
          isNull(monitorSlaSealedMonth.id),
        ),
      )
      .all(),
  );
  for (const row of unsealed) {
    // a member that joined after the month ended is never sealed for it
    if (row.joinedAt.getTime() < monthRange(month, row.timeZone).end) {
      waiting.add(row.policyId);
    }
  }
  return waiting;
}
