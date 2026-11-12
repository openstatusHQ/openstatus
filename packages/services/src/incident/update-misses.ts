import {
  and,
  db as defaultDb,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "@openstatus/db";
import {
  type Incident,
  type IncidentEvent,
  type Workspace,
  incident,
  incidentEvent,
  incidentMissedUpdates,
  incidentUpdateCadence,
  incidentUpdateMissedMessage,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { loadIncidentUpdateActivity } from "./update-activity";

/** Missed updates written per incident and tick; a long gap fills over a few ticks. */
export const MISSED_UPDATES_PER_TICK = 10;

export type DueIncidentMissedUpdates = {
  incident: Incident;
  workspace: Workspace;
  intervalMinutes: number;
  /** Where the interval restarted when the due times were computed. */
  startsAt: Date;
  /** Oldest first. */
  dueTimes: Date[];
};

export type IncidentMissedUpdateRecord = {
  incident: Incident;
  workspace: Workspace;
  intervalMinutes: number;
  dueAt: Date;
  event: IncidentEvent;
};

const activeCadenceCandidates = (workspaceIds?: number[]) =>
  and(
    workspaceIds ? inArray(incident.workspaceId, workspaceIds) : undefined,
    inArray(incident.status, ["open", "mitigated"]),
    isNull(incident.closedAt),
    isNotNull(incident.slaSnapshot),
    isNull(incident.resolutionStoppedAt),
  );

/** Elapsed update intervals not recorded yet, per incident with an active cadence, in every workspace. */
export async function dueIncidentMissedUpdates(args: {
  db: DB;
  now: Date;
  workspaceIds?: number[];
  limit?: number;
}): Promise<DueIncidentMissedUpdates[]> {
  if (args.workspaceIds?.length === 0) return [];
  const candidates = await args.db
    .select()
    .from(incident)
    .where(activeCadenceCandidates(args.workspaceIds))
    .all();
  if (candidates.length === 0) return [];

  const activity = await loadIncidentUpdateActivity(args.db, candidates);
  const recorded = await args.db
    .select({
      incidentId: incidentEvent.incidentId,
      at: sql<number | null>`max(${incidentEvent.createdAt})`,
    })
    .from(incidentEvent)
    .where(
      and(
        inArray(
          incidentEvent.incidentId,
          candidates.map((row) => row.id),
        ),
        eq(incidentEvent.type, "sla_update_missed"),
      ),
    )
    .groupBy(incidentEvent.incidentId)
    .all();
  const lastRecorded = new Map(
    recorded.flatMap((row) =>
      row.at === null ? [] : [[row.incidentId, new Date(row.at * 1000)]],
    ),
  );

  const pending: Array<Omit<DueIncidentMissedUpdates, "workspace">> = [];
  for (const row of candidates) {
    const rowActivity = activity.get(row.id);
    if (!rowActivity) continue;
    const cadence = incidentUpdateCadence(row, rowActivity, args.now);
    if (!cadence) continue;
    const dueTimes = incidentMissedUpdates(cadence, args.now, {
      after: lastRecorded.get(row.id),
      limit: args.limit ?? MISSED_UPDATES_PER_TICK,
    });
    if (dueTimes.length === 0) continue;
    pending.push({
      incident: row,
      intervalMinutes: cadence.intervalMinutes,
      startsAt: cadence.startsAt,
      dueTimes,
    });
  }
  if (pending.length === 0) return [];

  const workspaces = new Map<number, Workspace>();
  const rows = await args.db
    .select()
    .from(workspace)
    .where(
      inArray(workspace.id, [
        ...new Set(pending.map((p) => p.incident.workspaceId)),
      ]),
    )
    .all();
  for (const row of rows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (parsed.success) workspaces.set(parsed.data.id, parsed.data);
  }
  return pending.flatMap((p) => {
    const ws = workspaces.get(p.incident.workspaceId);
    return ws ? [{ ...p, workspace: ws }] : [];
  });
}

/**
 * Writes one incident's missed updates. Re-reads the cadence first so an update
 * posted since the due phase cancels them; the unique index makes a second
 * machine's write a no-op. Returns only the events this call inserted.
 */
// The audit rows come from `emitAudit` inside the loop.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function writeIncidentMissedUpdates(args: {
  db: DB;
  due: DueIncidentMissedUpdates;
  now: Date;
}): Promise<IncidentMissedUpdateRecord[]> {
  const { due } = args;
  const ctx: ServiceContext = {
    workspace: due.workspace,
    actor: { type: "system", job: "incident-update-misses" },
    db: args.db,
  };
  return withTransaction(ctx, async (tx) => {
    const current = await tx
      .select()
      .from(incident)
      .where(
        and(
          eq(incident.id, due.incident.id),
          eq(incident.workspaceId, due.workspace.id),
          activeCadenceCandidates(),
        ),
      )
      .get();
    if (!current) return [];
    const activity = await loadIncidentUpdateActivity(tx, [current]);
    const rowActivity = activity.get(current.id);
    const cadence = rowActivity
      ? incidentUpdateCadence(current, rowActivity, args.now)
      : null;
    if (
      cadence?.intervalMinutes !== due.intervalMinutes ||
      cadence.startsAt.getTime() !== due.startsAt.getTime()
    ) {
      return [];
    }

    const records: IncidentMissedUpdateRecord[] = [];
    for (const dueAt of due.dueTimes) {
      const event = await tx
        .insert(incidentEvent)
        .values({
          incidentId: current.id,
          type: "sla_update_missed",
          message: incidentUpdateMissedMessage({
            intervalMinutes: due.intervalMinutes,
            dueAt,
          }),
          source: "system",
          sourceRef: null,
          createdBy: null,
          createdAt: dueAt,
        })
        .onConflictDoNothing()
        .returning()
        .get();
      if (!event) continue;
      await emitAudit(tx, ctx, {
        action: "incident_event.create",
        entityType: "incident_event",
        entityId: event.id,
        after: event,
        metadata: { incidentId: current.id, type: event.type },
      });
      records.push({
        incident: current,
        workspace: due.workspace,
        intervalMinutes: due.intervalMinutes,
        dueAt,
        event,
      });
    }
    return records;
  });
}

/**
 * Records every elapsed update interval of tracked incidents, oldest first and
 * at most `limit` per incident and tick. No plan-limit check: the snapshot is
 * the gate. Safe on every machine at once.
 */
export async function recordIncidentMissedUpdates(
  args: { db?: DB; now?: Date; workspaceIds?: number[]; limit?: number } = {},
): Promise<IncidentMissedUpdateRecord[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const due = await dueIncidentMissedUpdates({
    db,
    now,
    workspaceIds: args.workspaceIds,
    limit: args.limit,
  });
  const recorded: IncidentMissedUpdateRecord[] = [];
  for (const item of due) {
    try {
      recorded.push(
        ...(await writeIncidentMissedUpdates({ db, due: item, now })),
      );
    } catch (error) {
      console.warn("incident missed updates not recorded", {
        incidentId: item.incident.id,
        error,
      });
    }
  }
  return recorded;
}
