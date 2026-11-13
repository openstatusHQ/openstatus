import {
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { assertMonitorSlaLimit, validatePolicyMonitorIds } from "./internal";
import { CreateMonitorSlaPolicyInput } from "./schemas";

export async function createMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: CreateMonitorSlaPolicyInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = CreateMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const monitorIds = await validatePolicyMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitorIds,
    });

    const row = await tx
      .insert(monitorSlaPolicy)
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
      await tx.insert(monitorSlaPolicyToMonitor).values(
        monitorIds.map((monitorId) => ({
          monitorSlaPolicyId: row.id,
          monitorId,
        })),
      );
    }

    const policy = { ...row, monitorIds };
    await emitAudit(tx, ctx, {
      action: "monitor_sla_policy.create",
      entityType: "monitor_sla_policy",
      entityId: row.id,
      after: policy,
    });
    return policy;
  });
}
