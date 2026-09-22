import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import { assertWithinLimit } from "../limits";
import type { Monitor } from "../types";
import { getMonitorInWorkspace } from "./internal";
import { CloneMonitorInput } from "./schemas";

/**
 * Duplicate a monitor. Fails with `LimitExceededError` when cloning would
 * push the workspace past its monitor quota.
 */
export async function cloneMonitor(args: {
  ctx: ServiceContext;
  input: CloneMonitorInput;
}): Promise<Monitor> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CloneMonitorInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertWithinLimit({
      tx,
      workspaceId: ctx.workspace.id,
      limit: "monitors",
    });

    const source = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const { id: _id, status: _status, ...rest } = source;
    const row = await tx
      .insert(monitor)
      .values({
        ...rest,
        // Don't inherit the source's current health — a freshly cloned
        // monitor hasn't been checked yet; let the next check settle it.
        status: "active",
        name: `${source.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();
    if (!row) {
      throw new InternalServiceError(`failed to clone monitor ${source.id}`);
    }

    await emitAudit(tx, ctx, {
      action: "monitor.create",
      entityType: "monitor",
      entityId: row.id,
      after: row,
      metadata: { clonedFromMonitorId: source.id },
    });

    return selectMonitorSchema.parse(row);
  });
}
