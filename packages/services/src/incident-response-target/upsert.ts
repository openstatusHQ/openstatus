import { eq } from "@openstatus/db";
import { incidentResponseTarget } from "@openstatus/db/src/schema";
import {
  type IncidentTargetTargets,
  incidentTargetTargetsError,
} from "@openstatus/db/src/schema/incident_response_targets/constants";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { ValidationError } from "../errors";
import {
  assertIncidentTargetLimit,
  assertNotKeyActor,
  findIncidentResponseTarget,
} from "./internal";
import { UpsertIncidentResponseTargetInput } from "./schemas";

/** Creates the workspace's one policy, or replaces it. Declared incidents keep their own copy. */
export async function upsertIncidentResponseTarget(args: {
  ctx: ServiceContext;
  input: UpsertIncidentResponseTargetInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = UpsertIncidentResponseTargetInput.parse(args.input);
  assertNotKeyActor(ctx);
  assertIncidentTargetLimit(ctx);

  const targets = compactTargets(input.targets);
  const error = incidentTargetTargetsError(targets);
  if (error) throw new ValidationError(error);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findIncidentResponseTarget(tx, ctx.workspace.id);

    if (!before) {
      const row = await tx
        .insert(incidentResponseTarget)
        .values({
          workspaceId: ctx.workspace.id,
          targets,
          resolutionStop: input.resolutionStop,
          responseMet: input.responseMet,
        })
        .returning()
        .get();
      await emitAudit(tx, ctx, {
        action: "incident_response_target.create",
        entityType: "incident_response_target",
        entityId: row.id,
        after: row,
      });
      return row;
    }

    const row = await tx
      .update(incidentResponseTarget)
      .set({
        targets,
        resolutionStop: input.resolutionStop,
        responseMet: input.responseMet,
        updatedAt: new Date(),
      })
      .where(eq(incidentResponseTarget.id, before.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident_response_target.update",
      entityType: "incident_response_target",
      entityId: row.id,
      before,
      after: row,
    });
    return row;
  });
}

function compactTargets(
  targets: UpsertIncidentResponseTargetInput["targets"],
): IncidentTargetTargets {
  const out: IncidentTargetTargets = {};
  for (const [severity, kinds] of Object.entries(targets) as [
    keyof IncidentTargetTargets,
    Record<string, number | null | undefined> | undefined,
  ][]) {
    const kept = Object.fromEntries(
      Object.entries(kinds ?? {}).filter(([, v]) => typeof v === "number"),
    );
    if (Object.keys(kept).length > 0) out[severity] = kept;
  }
  return out;
}
