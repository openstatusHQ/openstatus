import { eq } from "@openstatus/db";
import { incidentSlaPolicy } from "@openstatus/db/src/schema";
import {
  type IncidentSlaTargets,
  incidentSlaTargetsError,
} from "@openstatus/db/src/schema/incident_sla_policies/constants";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { ValidationError } from "../errors";
import {
  assertIncidentSlaLimit,
  assertNotKeyActor,
  findIncidentReporting,
} from "./internal";
import { UpsertIncidentReportingInput } from "./schemas";

/** Creates the workspace's one policy, or replaces it. Declared incidents keep their own copy. */
export async function upsertIncidentReporting(args: {
  ctx: ServiceContext;
  input: UpsertIncidentReportingInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = UpsertIncidentReportingInput.parse(args.input);
  assertNotKeyActor(ctx);
  assertIncidentSlaLimit(ctx);

  const targets = compactTargets(input.targets);
  const error = incidentSlaTargetsError(targets);
  if (error) throw new ValidationError(error);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findIncidentReporting(tx, ctx.workspace.id);

    if (!before) {
      const row = await tx
        .insert(incidentSlaPolicy)
        .values({
          workspaceId: ctx.workspace.id,
          targets,
          resolutionStop: input.resolutionStop,
          responseMet: input.responseMet,
        })
        .returning()
        .get();
      await emitAudit(tx, ctx, {
        action: "incident_sla_policy.create",
        entityType: "incident_sla_policy",
        entityId: row.id,
        after: row,
      });
      return row;
    }

    const row = await tx
      .update(incidentSlaPolicy)
      .set({
        targets,
        resolutionStop: input.resolutionStop,
        responseMet: input.responseMet,
        updatedAt: new Date(),
      })
      .where(eq(incidentSlaPolicy.id, before.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident_sla_policy.update",
      entityType: "incident_sla_policy",
      entityId: row.id,
      before,
      after: row,
    });
    return row;
  });
}

function compactTargets(
  targets: UpsertIncidentReportingInput["targets"],
): IncidentSlaTargets {
  const out: IncidentSlaTargets = {};
  for (const [severity, kinds] of Object.entries(targets) as [
    keyof IncidentSlaTargets,
    Record<string, number | null | undefined> | undefined,
  ][]) {
    const kept = Object.fromEntries(
      Object.entries(kinds ?? {}).filter(([, v]) => typeof v === "number"),
    );
    if (Object.keys(kept).length > 0) out[severity] = kept;
  }
  return out;
}
