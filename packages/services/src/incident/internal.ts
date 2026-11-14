import { and, eq, gte, isNull } from "@openstatus/db";
import {
  type Incident,
  type IncidentEvent,
  type IncidentEventSource,
  type IncidentEventType,
  type IncidentSlaFields,
  type IncidentSlaSnapshot,
  type IncidentSlaTimerKind,
  type IncidentStatus,
  incident,
  incidentEvent,
  incidentResponsePatch,
  incidentSlaBreachMessage,
  incidentSlaClockStart,
  incidentSlaResponseMet,
  incidentSlaState,
  statusReportUpdate,
  user,
} from "@openstatus/db/src/schema";

import { displayName } from "../attribution";
import { emitAudit } from "../audit";
import {
  type Actor,
  type DB,
  type ServiceContext,
  tryGetActorUserId,
} from "../context";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { findIncidentReporting } from "../incident-reporting/internal";
import { getMembership } from "../member/membership";

export const incidentUserColumns = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  photoUrl: true,
  deletedAt: true,
} as const;

export async function getIncidentInWorkspace(
  tx: DB,
  workspaceId: number,
  id: number,
): Promise<Incident> {
  const row = await tx
    .select()
    .from(incident)
    .where(and(eq(incident.id, id), eq(incident.workspaceId, workspaceId)))
    .get();
  if (!row) throw new NotFoundError("incident", id);
  return row;
}

export function assertNotClosed(row: Incident): void {
  if (row.closedAt) {
    throw new ConflictError(`Incident #${row.id} is closed`);
  }
}

const TRANSITIONS: Record<IncidentStatus, ReadonlyArray<IncidentStatus>> = {
  open: ["mitigated", "resolved", "canceled"],
  mitigated: ["resolved", "open", "canceled"],
  resolved: ["open"],
  canceled: [],
};

export function allowedTransitions(
  row: Pick<Incident, "status" | "closedAt">,
): ReadonlyArray<IncidentStatus> {
  if (row.closedAt) return [];
  return TRANSITIONS[row.status];
}

export function assertTransition(
  row: Pick<Incident, "id" | "status" | "closedAt">,
  to: IncidentStatus,
): void {
  if (row.status === to) {
    throw new ConflictError(`Incident #${row.id} is already ${to}`);
  }
  if (!allowedTransitions(row).includes(to)) {
    throw new ConflictError(
      `Incident #${row.id} cannot go from ${row.status} to ${to}`,
    );
  }
}

/** The member behind a person actor (`user`, `slack`); keys, MCP and jobs are not people. */
export function personUserId(actor: Actor): number | null {
  return actor.type === "user" || actor.type === "slack" ? actor.userId : null;
}

function actorSource(actor: Actor): IncidentEventSource {
  switch (actor.type) {
    case "user":
      return "dashboard";
    case "apiKey":
      return "api";
    case "mcp":
      return "mcp";
    case "slack":
      return "slack";
    case "system":
    case "webhook":
    case "subscriber":
      return "system";
  }
}

function actorSourceRef(actor: Actor): string | null {
  switch (actor.type) {
    case "apiKey":
    case "mcp":
      return actor.keyId;
    case "slack":
      return actor.permalink ?? null;
    default:
      return null;
  }
}

/** The policy fixed on a new incident; only with a policy and the `incident-sla` limit on. */
export async function slaSnapshotAtDeclare(
  tx: DB,
  ctx: ServiceContext,
): Promise<IncidentSlaSnapshot | null> {
  if (!ctx.workspace.limits["incident-sla"]) return null;
  const policy = await findIncidentReporting(tx, ctx.workspace.id);
  if (!policy) return null;
  return {
    targets: policy.targets,
    resolutionStop: policy.resolutionStop,
    responseMet: policy.responseMet,
  };
}

/**
 * The system's record of a missed target, at its due time; null when it was
 * already written. Never acknowledges and never counts as activity.
 */
export async function appendIncidentSlaBreach(
  tx: DB,
  ctx: ServiceContext,
  args: {
    incidentId: number;
    kind: IncidentSlaTimerKind;
    targetMinutes: number;
    dueAt: Date;
  },
): Promise<IncidentEvent | null> {
  const event = await tx
    .insert(incidentEvent)
    .values({
      incidentId: args.incidentId,
      type:
        args.kind === "response"
          ? "sla_response_breached"
          : "sla_resolution_breached",
      message: incidentSlaBreachMessage(args),
      source: "system",
      sourceRef: null,
      createdBy: null,
      createdAt: args.dueAt,
    })
    .onConflictDoNothing()
    .returning()
    .get();
  if (!event) return null;
  await emitAudit(tx, ctx, {
    action: "incident_event.create",
    entityType: "incident_event",
    entityId: event.id,
    after: event,
    metadata: { incidentId: args.incidentId, type: event.type },
  });
  return event;
}

/** The breach events for the misses a write just stamped; `before` is the row it judged. */
export async function appendIncidentSlaBreaches(
  tx: DB,
  ctx: ServiceContext,
  before: IncidentSlaFields & { id: number },
  stamped: { responseBreachDueAt?: Date; resolutionBreachDueAt?: Date },
  at: Date,
): Promise<void> {
  const state = incidentSlaState(before, at);
  const misses = [
    ["response", stamped.responseBreachDueAt],
    ["resolution", stamped.resolutionBreachDueAt],
  ] as const;
  for (const [kind, dueAt] of misses) {
    const targetMinutes = state?.[kind]?.targetMinutes;
    if (!dueAt || targetMinutes === undefined) continue;
    await appendIncidentSlaBreach(tx, ctx, {
      incidentId: before.id,
      kind,
      targetMinutes,
      dueAt,
    });
  }
}

/** Where a response patch may land: still unmet, and unstamped when it stamps the miss. */
export function responsePatchGuard(
  incidentId: number,
  patch: { responseBreachDueAt?: Date },
) {
  return and(
    eq(incident.id, incidentId),
    isNull(incident.responseMetAt),
    patch.responseBreachDueAt
      ? isNull(incident.responseBreachDueAt)
      : undefined,
  );
}

/** Meets a tracked incident's response at `at`, once; a late meet stamps the miss in the same write. */
export async function meetResponse(
  tx: DB,
  ctx: ServiceContext,
  incidentId: number,
  at: Date,
): Promise<void> {
  const existing = await getIncidentInWorkspace(
    tx,
    ctx.workspace.id,
    incidentId,
  );
  const patch = incidentResponsePatch(existing, at);
  if (!patch.responseMetAt) return;
  const updated = await tx
    .update(incident)
    .set({ ...patch, updatedAt: new Date() })
    .where(responsePatchGuard(incidentId, patch))
    .returning()
    .get();
  if (!updated) {
    // the miss was stamped meanwhile: meet it without stamping again
    if (patch.responseBreachDueAt) await meetResponse(tx, ctx, incidentId, at);
    return;
  }
  await emitAudit(tx, ctx, {
    action: "incident.update",
    entityType: "incident",
    entityId: updated.id,
    before: existing,
    after: updated,
  });
  await appendIncidentSlaBreaches(tx, ctx, existing, patch, at);
}

/**
 * In `status_report` mode, meets the response of the incident holding the report
 * once the report has an update created at or after the clock start.
 */
export async function meetResponseByStatusReport(
  tx: DB,
  ctx: ServiceContext,
  statusReportId: number,
  at: Date,
): Promise<void> {
  const holder = await tx
    .select()
    .from(incident)
    .where(
      and(
        eq(incident.statusReportId, statusReportId),
        eq(incident.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (
    !holder?.slaSnapshot ||
    holder.responseMetAt ||
    incidentSlaResponseMet(holder.slaSnapshot) !== "status_report"
  ) {
    return;
  }
  const update = await tx
    .select({ id: statusReportUpdate.id })
    .from(statusReportUpdate)
    .where(
      and(
        eq(statusReportUpdate.statusReportId, statusReportId),
        gte(statusReportUpdate.createdAt, incidentSlaClockStart(holder)),
      ),
    )
    .get();
  if (update) await meetResponse(tx, ctx, holder.id, at);
}

// Set once, at the write's time: a person's event acknowledges as them, resolving
// does for any actor. Resolving meets the response; acknowledging does unless
// the snapshot counts status report updates instead.
async function acknowledgeOnEvent(
  tx: DB,
  ctx: ServiceContext,
  incidentId: number,
  type: IncidentEventType,
): Promise<void> {
  const personId = personUserId(ctx.actor);
  if (personId === null && type !== "resolved") return;
  const now = new Date();
  const acknowledged = await tx
    .update(incident)
    .set({
      acknowledgedAt: now,
      acknowledgedBy: personId ?? tryGetActorUserId(ctx.actor),
      updatedAt: now,
    })
    .where(and(eq(incident.id, incidentId), isNull(incident.acknowledgedAt)))
    .returning()
    .get();
  if (!acknowledged) {
    if (type === "resolved") await meetResponse(tx, ctx, incidentId, now);
    return;
  }
  const patch =
    type === "resolved" ||
    incidentSlaResponseMet(acknowledged.slaSnapshot) === "acknowledged"
      ? incidentResponsePatch(acknowledged, now)
      : {};
  const met = patch.responseMetAt
    ? await tx
        .update(incident)
        .set({ ...patch, updatedAt: now })
        .where(responsePatchGuard(incidentId, patch))
        .returning()
        .get()
    : undefined;
  const updated = met ?? acknowledged;
  await emitAudit(tx, ctx, {
    action: "incident.update",
    entityType: "incident",
    entityId: updated.id,
    before: {
      ...acknowledged,
      acknowledgedAt: null,
      acknowledgedBy: null,
    },
    after: updated,
  });
  if (met) await appendIncidentSlaBreaches(tx, ctx, acknowledged, patch, now);
  else if (patch.responseMetAt) await meetResponse(tx, ctx, incidentId, now);
}

/** Verbs that wrote events return this, so an acknowledgement or response they caused shows. */
export async function withAcknowledgement(
  tx: DB,
  row: Incident,
): Promise<Incident> {
  if (row.acknowledgedAt && (!row.slaSnapshot || row.responseMetAt)) {
    return row;
  }
  return getIncidentInWorkspace(tx, row.workspaceId, row.id);
}

/** The only way an event is written: the row, its audit entry and the acknowledgement it implies. */
export async function appendIncidentEvent(
  tx: DB,
  ctx: ServiceContext,
  args: {
    incidentId: number;
    type: IncidentEventType;
    message?: string | null;
    createdAt?: Date;
    createdBy?: number | null;
    source?: IncidentEventSource;
    sourceRef?: string | null;
  },
): Promise<IncidentEvent> {
  const event = await tx
    .insert(incidentEvent)
    .values({
      incidentId: args.incidentId,
      type: args.type,
      message: args.message ?? null,
      source: args.source ?? actorSource(ctx.actor),
      sourceRef:
        args.sourceRef !== undefined
          ? args.sourceRef
          : actorSourceRef(ctx.actor),
      createdBy: args.createdBy ?? tryGetActorUserId(ctx.actor),
      createdAt: args.createdAt ?? new Date(),
    })
    .returning()
    .get();
  await emitAudit(tx, ctx, {
    action: "incident_event.create",
    entityType: "incident_event",
    entityId: event.id,
    after: event,
    metadata: { incidentId: args.incidentId, type: args.type },
  });
  await acknowledgeOnEvent(tx, ctx, args.incidentId, args.type);
  return event;
}

export async function assertMember(
  tx: DB,
  workspaceId: number,
  userId: number,
): Promise<void> {
  const membership = await getMembership(tx, userId, workspaceId);
  if (!membership) {
    throw new ValidationError(
      `User ${userId} is not a member of this workspace`,
    );
  }
}

export async function userDisplayName(
  tx: DB,
  userId: number | null,
): Promise<string | null> {
  if (userId === null) return null;
  const row = await tx
    .select({
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!row) return null;
  return displayName(row);
}
