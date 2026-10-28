import { and, db as defaultDb, eq, isNull, lt, or } from "@openstatus/db";
import {
  type HeartbeatPingKind,
  monitor,
  monitorHeartbeatState,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { ValidationError } from "../errors";
import type { Monitor } from "../types";
import {
  generateHeartbeatToken,
  getMonitorInWorkspace,
  monitorAuditSnapshot,
} from "./internal";
import {
  GetMonitorInput,
  RegenerateHeartbeatTokenInput,
  UpdateMonitorHeartbeatInput,
} from "./schemas";

export type HeartbeatState = {
  lastPingAt: Date | null;
  /** `fail` when the last ping was a `/fail`; null before the first ping. */
  lastPingKind: HeartbeatPingKind | null;
  nextDueAt: Date | null;
};

export function heartbeatDeadline(
  from: Date,
  config: { heartbeatPeriod: number | null; heartbeatGrace: number | null },
): Date {
  const seconds = (config.heartbeatPeriod ?? 0) + (config.heartbeatGrace ?? 0);
  return new Date(from.getTime() + seconds * 1000);
}

export function heartbeatConfigChanged(
  before: { heartbeatPeriod: number | null; heartbeatGrace: number | null },
  after: { heartbeatPeriod: number | null; heartbeatGrace: number | null },
): boolean {
  return (
    before.heartbeatPeriod !== after.heartbeatPeriod ||
    before.heartbeatGrace !== after.heartbeatGrace
  );
}

function assertHeartbeat(row: { jobType: string; id: number }) {
  if (row.jobType !== "heartbeat") {
    throw new ValidationError(`Monitor ${row.id} is not a heartbeat monitor`);
  }
}

/**
 * Re-anchor the deadline of a heartbeat that has been pinged at least once:
 * on `last-ping` after a config change, on `now` when it is resumed.
 * A heartbeat still waiting for its first ping keeps a NULL deadline.
 * A down heartbeat keeps its deadline on a config change: the sweep reads a
 * future deadline as "pinged again", and only a ping may recover it.
 */
export async function syncHeartbeatDeadline(args: {
  tx: DB;
  row: {
    id: number;
    jobType: string;
    status: string;
    heartbeatPeriod: number | null;
    heartbeatGrace: number | null;
  };
  anchor: "last-ping" | "now";
}): Promise<void> {
  const { tx, row, anchor } = args;
  if (row.jobType !== "heartbeat") return;
  if (anchor === "last-ping" && row.status === "error") return;

  const state = await tx
    .select()
    .from(monitorHeartbeatState)
    .where(eq(monitorHeartbeatState.monitorId, row.id))
    .get();
  if (!state?.lastPingAt) return;

  const from = anchor === "now" ? new Date() : state.lastPingAt;
  await tx
    .update(monitorHeartbeatState)
    .set({
      nextDueAt: heartbeatDeadline(from, row),
      // a resume starts fresh: a failure reported before the pause no longer counts
      ...(anchor === "now" ? { lastPingKind: "success" as const } : {}),
    })
    .where(eq(monitorHeartbeatState.monitorId, row.id));
}

export async function updateMonitorHeartbeat(args: {
  ctx: ServiceContext;
  input: UpdateMonitorHeartbeatInput;
}): Promise<Monitor> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateMonitorHeartbeatInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    assertHeartbeat(existing);

    const updated = await tx
      .update(monitor)
      .set({
        heartbeatPeriod: input.heartbeatPeriod,
        heartbeatGrace: input.heartbeatGrace,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id))
      .returning()
      .get();

    // An unchanged save must not undo the fresh deadline a resume granted.
    if (heartbeatConfigChanged(existing, updated)) {
      await syncHeartbeatDeadline({ tx, row: updated, anchor: "last-ping" });
    }

    await emitAudit(tx, ctx, {
      action: "monitor.update",
      entityType: "monitor",
      entityId: existing.id,
      before: await monitorAuditSnapshot(existing),
      after: await monitorAuditSnapshot(updated),
    });

    return selectMonitorSchema.parse(updated);
  });
}

export async function regenerateHeartbeatToken(args: {
  ctx: ServiceContext;
  input: RegenerateHeartbeatTokenInput;
}): Promise<Monitor> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = RegenerateHeartbeatTokenInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    assertHeartbeat(existing);

    const updated = await tx
      .update(monitor)
      .set({ heartbeatToken: generateHeartbeatToken(), updatedAt: new Date() })
      .where(eq(monitor.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "monitor.update",
      entityType: "monitor",
      entityId: existing.id,
      before: await monitorAuditSnapshot(existing),
      after: await monitorAuditSnapshot(updated),
    });

    return selectMonitorSchema.parse(updated);
  });
}

export async function getHeartbeatState(args: {
  ctx: ServiceContext;
  input: GetMonitorInput;
}): Promise<HeartbeatState> {
  const { ctx } = args;
  const input = GetMonitorInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const existing = await getMonitorInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  assertHeartbeat(existing);

  const state = await db
    .select()
    .from(monitorHeartbeatState)
    .where(eq(monitorHeartbeatState.monitorId, existing.id))
    .get();

  return {
    lastPingAt: state?.lastPingAt ?? null,
    lastPingKind: state?.lastPingAt ? state.lastPingKind : null,
    nextDueAt: state?.nextDueAt ?? null,
  };
}

export type HeartbeatPingResult =
  | { kind: "not-found" }
  | { kind: "paused"; monitorId: number; workspaceId: number }
  | { kind: "recorded"; monitorId: number; workspaceId: number };

/**
 * The public ping write: authenticated by the token alone and not audited,
 * like a check result. Only the deadline drives alerting; the sweep in
 * `apps/workflows` applies the transitions.
 */
export async function recordHeartbeatPing(args: {
  token: string;
  at: Date;
  db?: DB;
}): Promise<HeartbeatPingResult> {
  const db = args.db ?? defaultDb;
  const row = await db
    .select({
      id: monitor.id,
      workspaceId: monitor.workspaceId,
      active: monitor.active,
      heartbeatPeriod: monitor.heartbeatPeriod,
      heartbeatGrace: monitor.heartbeatGrace,
    })
    .from(monitor)
    .where(
      and(
        eq(monitor.heartbeatToken, args.token),
        eq(monitor.jobType, "heartbeat"),
        isNull(monitor.deletedAt),
      ),
    )
    .get();
  if (!row?.workspaceId) return { kind: "not-found" };

  const ids = { monitorId: row.id, workspaceId: row.workspaceId };
  if (!row.active) return { kind: "paused", ...ids };

  const nextDueAt = heartbeatDeadline(args.at, row);
  await db
    .insert(monitorHeartbeatState)
    .values({ monitorId: row.id, lastPingAt: args.at, nextDueAt })
    .onConflictDoUpdate({
      target: monitorHeartbeatState.monitorId,
      set: { lastPingAt: args.at, nextDueAt },
      // a slower, older ping must not pull the deadline back
      setWhere: or(
        isNull(monitorHeartbeatState.lastPingAt),
        lt(monitorHeartbeatState.lastPingAt, args.at),
      ),
    });
  return { kind: "recorded", ...ids };
}
