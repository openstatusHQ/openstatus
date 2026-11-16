import { uptimeTarget, uptimeTargetToMonitor } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { assertUptimeTargetLimit, validatePolicyMonitorIds } from "./internal";
import { CreateUptimeTargetInput } from "./schemas";

export async function createUptimeTarget(args: {
  ctx: ServiceContext;
  input: CreateUptimeTargetInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = CreateUptimeTargetInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const monitorIds = await validatePolicyMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitorIds,
    });

    const row = await tx
      .insert(uptimeTarget)
      .values({
        workspaceId: ctx.workspace.id,
        name: input.name,
        target: input.target,
        strict: input.strict,
        timeZone: input.timeZone,
      })
      .returning()
      .get();

    if (monitorIds.length > 0) {
      await tx.insert(uptimeTargetToMonitor).values(
        monitorIds.map((monitorId) => ({
          uptimeTargetId: row.id,
          monitorId,
        })),
      );
    }

    const policy = { ...row, monitorIds };
    await emitAudit(tx, ctx, {
      action: "uptime_target.create",
      entityType: "uptime_target",
      entityId: row.id,
      after: policy,
    });
    return policy;
  });
}
