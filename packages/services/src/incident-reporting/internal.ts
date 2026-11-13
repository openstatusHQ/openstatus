import { eq } from "@openstatus/db";
import { incidentSlaPolicy } from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import { ForbiddenError } from "../errors";

export function assertIncidentSlaLimit(ctx: ServiceContext): void {
  if (!ctx.workspace.limits["incident-sla"]) {
    throw new ForbiddenError("Incident SLA is not enabled on this plan.");
  }
}

/** Only people configure the policy; a key passes `requireRole` through its user. */
export function assertNotKeyActor(ctx: ServiceContext): void {
  if (ctx.actor.type === "apiKey" || ctx.actor.type === "mcp") {
    throw new ForbiddenError(
      "The incident SLA policy can only be changed by a person.",
    );
  }
}

export async function findIncidentSlaPolicy(db: DB, workspaceId: number) {
  const row = await db
    .select()
    .from(incidentSlaPolicy)
    .where(eq(incidentSlaPolicy.workspaceId, workspaceId))
    .get();
  return row ?? null;
}
