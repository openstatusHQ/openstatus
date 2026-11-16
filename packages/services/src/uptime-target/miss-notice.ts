import { and, asc, db as defaultDb, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  uptimeTargetMissNotice,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { monthRange } from "../frozen-uptime/compute";
import { FREEZE_CUTOFF_MS } from "../frozen-uptime/run";
import { withBusyRetry } from "../retry";

const DAY_MS = 86_400_000;

export type UptimeTargetMissNotice = {
  month: string;
  workspaceId: number;
  workspaceName: string;
  /** workspace owners */
  to: string[];
  /** the terms the month was sealed with */
  policy: { id: number; name: string; target: number; strict: boolean };
  /** sealed misses of current members, by monitor id */
  monitors: { id: number; name: string; uptime: number; target: number }[];
};

/**
 * Claims the "missed target" email for every policy with a sealed miss in `month` and none yet,
 * once no member waits to be sealed (or on the seal window's last day). The claim row is the
 * arbiter, so overlapping runs send it once. No audit row: a system job, like the seal.
 */
export async function claimUptimeTargetMissNotices(args: {
  db?: DB;
  month: string;
  now?: Date;
  policyIds?: number[];
  /** policies the seal run left pairs unsealed for because their checks were not stored yet */
  unavailablePolicyIds?: readonly number[];
}): Promise<UptimeTargetMissNotice[]> {
  const db = args.db ?? defaultDb;
  const { month } = args;
  const now = (args.now ?? new Date()).getTime();
  if (args.policyIds?.length === 0) return [];

  const misses = await withBusyRetry(() =>
    db
      .select({
        policyId: uptimeTarget.id,
        policyName: uptimeTarget.name,
        timeZone: uptimeTarget.timeZone,
        workspaceId: uptimeTarget.workspaceId,
        monitorId: monitor.id,
        monitorName: monitor.name,
        uptime: uptimeTargetSealedMonth.uptime,
        target: uptimeTargetSealedMonth.target,
        strict: uptimeTargetSealedMonth.strict,
      })
      .from(uptimeTargetSealedMonth)
      .innerJoin(
        uptimeTarget,
        eq(uptimeTarget.id, uptimeTargetSealedMonth.uptimeTargetId),
      )
      .innerJoin(
        uptimeTargetToMonitor,
        and(
          eq(
            uptimeTargetToMonitor.uptimeTargetId,
            uptimeTargetSealedMonth.uptimeTargetId,
          ),
          eq(
            uptimeTargetToMonitor.monitorId,
            uptimeTargetSealedMonth.monitorId,
          ),
        ),
      )
      .innerJoin(monitor, eq(monitor.id, uptimeTargetSealedMonth.monitorId))
      .leftJoin(
        uptimeTargetMissNotice,
        and(
          eq(uptimeTargetMissNotice.uptimeTargetId, uptimeTarget.id),
          eq(uptimeTargetMissNotice.month, month),
        ),
      )
      .where(
        and(
          args.policyIds ? inArray(uptimeTarget.id, args.policyIds) : undefined,
          eq(uptimeTargetSealedMonth.month, month),
          eq(uptimeTargetSealedMonth.met, false),
          isNull(uptimeTarget.archivedAt),
          isNull(monitor.deletedAt),
          isNull(uptimeTargetMissNotice.uptimeTargetId),
        ),
      )
      .orderBy(asc(uptimeTarget.id), asc(monitor.id))
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
        .insert(uptimeTargetMissNotice)
        .values({
          uptimeTargetId: policyId,
          workspaceId: rows[0].workspaceId,
          month,
        })
        .onConflictDoNothing()
        .returning({ policyId: uptimeTargetMissNotice.uptimeTargetId }),
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
        target: first.target,
        strict: first.strict,
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

/** Drops a claim whose email failed, so the next run inside the seal window sends it again. */
export async function releaseUptimeTargetMissNotice(args: {
  db?: DB;
  policyId: number;
  month: string;
}) {
  const db = args.db ?? defaultDb;
  await withBusyRetry(() =>
    db
      .delete(uptimeTargetMissNotice)
      .where(
        and(
          eq(uptimeTargetMissNotice.uptimeTargetId, args.policyId),
          eq(uptimeTargetMissNotice.month, args.month),
        ),
      ),
  );
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
        policyId: uptimeTargetToMonitor.uptimeTargetId,
        timeZone: uptimeTarget.timeZone,
        joinedAt: uptimeTargetToMonitor.createdAt,
      })
      .from(uptimeTargetToMonitor)
      .innerJoin(
        uptimeTarget,
        eq(uptimeTarget.id, uptimeTargetToMonitor.uptimeTargetId),
      )
      .innerJoin(monitor, eq(monitor.id, uptimeTargetToMonitor.monitorId))
      .leftJoin(
        uptimeTargetSealedMonth,
        and(
          eq(
            uptimeTargetSealedMonth.uptimeTargetId,
            uptimeTargetToMonitor.uptimeTargetId,
          ),
          eq(uptimeTargetSealedMonth.monitorId, monitor.id),
          eq(uptimeTargetSealedMonth.month, month),
        ),
      )
      .where(
        and(
          inArray(uptimeTargetToMonitor.uptimeTargetId, open),
          isNull(monitor.deletedAt),
          isNull(uptimeTargetSealedMonth.id),
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
