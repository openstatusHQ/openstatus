import { eq } from "@openstatus/db";
import { incidentResponseTarget } from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import { ForbiddenError } from "../errors";

export function assertIncidentTargetLimit(ctx: ServiceContext): void {
  if (!ctx.workspace.limits["incident-targets"]) {
    throw new ForbiddenError(
      "Incident response targets are not enabled on this plan.",
    );
  }
}

/** Only people configure the policy; a key passes `requireRole` through its user. */
export function assertNotKeyActor(ctx: ServiceContext): void {
  if (ctx.actor.type === "apiKey" || ctx.actor.type === "mcp") {
    throw new ForbiddenError(
      "Incident response targets can only be changed by a person.",
    );
  }
}

export async function findIncidentResponseTarget(db: DB, workspaceId: number) {
  const row = await db
    .select()
    .from(incidentResponseTarget)
    .where(eq(incidentResponseTarget.workspaceId, workspaceId))
    .get();
  return row ?? null;
}
