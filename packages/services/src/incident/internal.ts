import { and, eq } from "@openstatus/db";
import {
  type Incident,
  type IncidentEvent,
  type IncidentEventType,
  type IncidentStatus,
  incident,
  incidentEvent,
  user,
} from "@openstatus/db/src/schema";

import { displayName } from "../attribution";
import { emitAudit } from "../audit";
import { type DB, type ServiceContext, tryGetActorUserId } from "../context";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { requireFeature } from "../features";
import { getMembership } from "../member/membership";

export { displayName };

export const INCIDENT_FEATURE = "incident-management";

export function requireIncidentFeature(ctx: ServiceContext): void {
  requireFeature(ctx, INCIDENT_FEATURE);
}

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

/** The only way an event is written: the row and its audit entry together. */
export async function appendIncidentEvent(
  tx: DB,
  ctx: ServiceContext,
  args: {
    incidentId: number;
    type: IncidentEventType;
    message?: string | null;
    createdAt?: Date;
  },
): Promise<IncidentEvent> {
  const event = await tx
    .insert(incidentEvent)
    .values({
      incidentId: args.incidentId,
      type: args.type,
      message: args.message ?? null,
      createdBy: tryGetActorUserId(ctx.actor),
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
