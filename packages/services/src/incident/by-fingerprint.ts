import { and, eq, isNull, lt, sql } from "@openstatus/db";
import { alertSource, incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import type { Incident } from "../types";

export type UpsertByFingerprintInput = {
  alertSourceId: number;
  fingerprint: string;
  title: string;
  summary?: string;
  severity: "critical" | "warning" | "info";
  startedAt?: Date;
};

export type UpsertByFingerprintResult = {
  incident: Incident;
  created: boolean;
};

export async function upsertIncidentByFingerprint(args: {
  ctx: ServiceContext;
  input: UpsertByFingerprintInput;
}): Promise<UpsertByFingerprintResult> {
  const { ctx, input } = args;
  requireScope(ctx, "write");

  return withTransaction(ctx, async (tx) => {
    const open = await findOpenByFingerprint(tx, {
      workspaceId: ctx.workspace.id,
      alertSourceId: input.alertSourceId,
      fingerprint: input.fingerprint,
    });

    const now = new Date();

    if (open) {
      const refreshed = await tx
        .update(incidentTable)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(incidentTable.id, open.id))
        .returning()
        .get();
      return { incident: refreshed, created: false };
    }

    const startedAt = input.startedAt ?? now;
    const record = await tx
      .insert(incidentTable)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        summary: input.summary ?? "",
        severity: input.severity,
        origin: "external",
        fingerprint: input.fingerprint,
        alertSourceId: input.alertSourceId,
        startedAt,
        lastSeenAt: now,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.create",
      entityType: "incident",
      entityId: record.id,
      after: record,
    });

    return { incident: record, created: true };
  });
}

export async function resolveIncidentByFingerprint(args: {
  ctx: ServiceContext;
  input: { alertSourceId: number; fingerprint: string };
}): Promise<Incident | null> {
  const { ctx, input } = args;
  requireScope(ctx, "write");

  return withTransaction(ctx, async (tx) => {
    const open = await findOpenByFingerprint(tx, {
      workspaceId: ctx.workspace.id,
      alertSourceId: input.alertSourceId,
      fingerprint: input.fingerprint,
    });
    if (!open) return null;

    const now = new Date();
    const resolved = await tx
      .update(incidentTable)
      .set({
        resolvedAt: now,
        status: "resolved",
        autoResolved: true,
        updatedAt: now,
      })
      .where(
        and(eq(incidentTable.id, open.id), isNull(incidentTable.resolvedAt)),
      )
      .returning()
      .get();

    if (!resolved) return null;

    await emitAudit(tx, ctx, {
      action: "incident.resolve",
      entityType: "incident",
      entityId: resolved.id,
      before: open,
      after: resolved,
    });

    return resolved;
  });
}

async function findOpenByFingerprint(
  tx: DB,
  args: { workspaceId: number; alertSourceId: number; fingerprint: string },
) {
  return tx
    .select()
    .from(incidentTable)
    .where(
      and(
        eq(incidentTable.workspaceId, args.workspaceId),
        eq(incidentTable.alertSourceId, args.alertSourceId),
        eq(incidentTable.fingerprint, args.fingerprint),
        isNull(incidentTable.resolvedAt),
      ),
    )
    .get();
}

export type SweepResult = { resolvedIds: number[] };

/**
 * Closes incidents whose source has stopped re-firing. Alertmanager and Grafana
 * refresh on their repeat interval, so a live outage keeps resetting the clock;
 * sources that never send a resolve drain out here instead of accumulating.
 */
export async function sweepStaleIncidents(args: {
  ctx: ServiceContext;
  input?: { now?: Date };
}): Promise<SweepResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const now = args.input?.now ?? new Date();

  return withTransaction(ctx, async (tx) => {
    const cutoffExpr = sql`datetime(${Math.floor(now.getTime() / 1000)}, 'unixepoch')`;

    const stale = await tx
      .select({
        incident: incidentTable,
        windowMinutes: sql<number>`COALESCE(json_extract(${alertSource.config}, '$.stalenessWindowMinutes'), 360)`,
      })
      .from(incidentTable)
      .innerJoin(alertSource, eq(incidentTable.alertSourceId, alertSource.id))
      .where(
        and(
          eq(incidentTable.workspaceId, ctx.workspace.id),
          eq(incidentTable.origin, "external"),
          isNull(incidentTable.resolvedAt),
          lt(
            sql`datetime(${incidentTable.lastSeenAt}, 'unixepoch')`,
            sql`datetime(${cutoffExpr}, '-' || COALESCE(json_extract(${alertSource.config}, '$.stalenessWindowMinutes'), 360) || ' minutes')`,
          ),
        ),
      )
      .all();

    const resolvedIds: number[] = [];
    for (const { incident } of stale) {
      const resolved = await tx
        .update(incidentTable)
        .set({
          resolvedAt: now,
          status: "resolved",
          autoResolved: true,
          updatedAt: now,
        })
        .where(
          and(
            eq(incidentTable.id, incident.id),
            isNull(incidentTable.resolvedAt),
          ),
        )
        .returning()
        .get();
      if (!resolved) continue;
      resolvedIds.push(resolved.id);
      await emitAudit(tx, ctx, {
        action: "incident.resolve",
        entityType: "incident",
        entityId: resolved.id,
        before: incident,
        after: resolved,
      });
    }

    return { resolvedIds };
  });
}
