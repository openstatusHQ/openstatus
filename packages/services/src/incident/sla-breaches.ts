import {
  and,
  db as defaultDb,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
} from "@openstatus/db";
import {
  type Incident,
  type IncidentEvent,
  type IncidentSlaTimerKind,
  type Workspace,
  incident,
  incidentSlaState,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { appendIncidentSlaBreach } from "./internal";

export type DueIncidentSlaBreach = {
  incident: Incident;
  workspace: Workspace;
  kind: IncidentSlaTimerKind;
  targetMinutes: number;
  dueAt: Date;
};

export type IncidentSlaBreachRecord = DueIncidentSlaBreach & {
  /** The row after the stamp. */
  incident: Incident;
  event: IncidentEvent | null;
};

const stampColumns = {
  response: {
    met: incident.responseMetAt,
    breach: incident.responseBreachDueAt,
  },
  resolution: {
    met: incident.resolutionStoppedAt,
    breach: incident.resolutionBreachDueAt,
  },
} as const;

/** Unmet, unstamped timers of tracked incidents that are past their due time, in every workspace. */
export async function dueIncidentSlaBreaches(args: {
  db: DB;
  now: Date;
  workspaceIds?: number[];
}): Promise<DueIncidentSlaBreach[]> {
  if (args.workspaceIds?.length === 0) return [];
  const candidates = await args.db
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
            isNull(incident.responseBreachDueAt),
          ),
          and(
            isNull(incident.resolutionStoppedAt),
            isNull(incident.resolutionBreachDueAt),
          ),
        ),
      ),
    )
    .all();
  if (candidates.length === 0) return [];

  const workspaces = new Map<number, Workspace>();
  const rows = await args.db
    .select()
    .from(workspace)
    .where(
      inArray(workspace.id, [...new Set(candidates.map((c) => c.workspaceId))]),
    )
    .all();
  for (const row of rows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (parsed.success) workspaces.set(parsed.data.id, parsed.data);
  }

  const due: DueIncidentSlaBreach[] = [];
  for (const row of candidates) {
    const ws = workspaces.get(row.workspaceId);
    const state = incidentSlaState(row, args.now);
    if (!ws || !state) continue;
    for (const kind of ["response", "resolution"] as const) {
      const timer = state[kind];
      if (!timer || timer.metAt || timer.breachDueAt) continue;
      if (args.now.getTime() <= timer.dueAt.getTime()) continue;
      due.push({
        incident: row,
        workspace: ws,
        kind,
        targetMinutes: timer.targetMinutes,
        dueAt: timer.dueAt,
      });
    }
  }
  return due;
}

/**
 * Stamps one miss with a single conditional update, guarded on the timer still
 * unmet and its due time unchanged (severity and clock start as read). Only the
 * winner writes the breach event, in the same transaction. Null when it lost.
 */
// The audit rows come from `emitAudit` here and from `appendIncidentSlaBreach`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function stampIncidentSlaBreach(args: {
  db: DB;
  due: DueIncidentSlaBreach;
}): Promise<IncidentSlaBreachRecord | null> {
  const { due } = args;
  const before = due.incident;
  const columns = stampColumns[due.kind];
  const ctx: ServiceContext = {
    workspace: due.workspace,
    actor: { type: "system", job: "incident-sla-breaches" },
    db: args.db,
  };
  return withTransaction(ctx, async (tx) => {
    const updated = await tx
      .update(incident)
      .set(
        due.kind === "response"
          ? { responseBreachDueAt: due.dueAt }
          : { resolutionBreachDueAt: due.dueAt },
      )
      .where(
        and(
          eq(incident.id, before.id),
          eq(incident.workspaceId, due.workspace.id),
          inArray(incident.status, ["open", "mitigated"]),
          isNull(incident.closedAt),
          isNull(columns.met),
          isNull(columns.breach),
          eq(incident.severity, before.severity),
          eq(incident.declaredAt, before.declaredAt),
          before.reportedAt
            ? eq(incident.reportedAt, before.reportedAt)
            : isNull(incident.reportedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) return null;
    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before,
      after: updated,
    });
    const event = await appendIncidentSlaBreach(tx, ctx, {
      incidentId: updated.id,
      kind: due.kind,
      targetMinutes: due.targetMinutes,
      dueAt: due.dueAt,
    });
    return { ...due, incident: updated, event };
  });
}

/**
 * Records every running timer past its due time, for all workspaces with or
 * without Slack. No plan-limit check: the snapshot taken at declare is the gate.
 * Safe on every machine at once: each miss is one conditional update.
 */
export async function recordIncidentSlaBreaches(
  args: { db?: DB; now?: Date; workspaceIds?: number[] } = {},
): Promise<IncidentSlaBreachRecord[]> {
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();
  const due = await dueIncidentSlaBreaches({
    db,
    now,
    workspaceIds: args.workspaceIds,
  });
  const recorded: IncidentSlaBreachRecord[] = [];
  // a second stamp on the same incident audits against the first one's row
  const latest = new Map<number, Incident>();
  for (const item of due) {
    try {
      const record = await stampIncidentSlaBreach({
        db,
        due: {
          ...item,
          incident: latest.get(item.incident.id) ?? item.incident,
        },
      });
      if (!record) continue;
      latest.set(record.incident.id, record.incident);
      recorded.push(record);
    } catch (error) {
      console.warn("incident sla breach not recorded", {
        incidentId: item.incident.id,
        kind: item.kind,
        error,
      });
    }
  }
  return recorded;
}
