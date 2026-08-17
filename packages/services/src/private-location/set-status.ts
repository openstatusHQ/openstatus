import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import type { PrivateLocation } from "../types";
import { SetPrivateLocationStatusInput } from "./schemas";

/**
 * Set a private location's health status. Cron-only writer — the value is
 * derived from the agent heartbeat, never from user input. Returns early
 * without a write or audit row when the status is unchanged.
 */
export async function setPrivateLocationStatus(args: {
  ctx: ServiceContext;
  input: SetPrivateLocationStatusInput;
}): Promise<PrivateLocation> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = SetPrivateLocationStatusInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await tx.query.privateLocation.findFirst({
      where: and(
        eq(privateLocation.id, input.id),
        eq(privateLocation.workspaceId, ctx.workspace.id),
      ),
    });

    if (!existing) {
      throw new NotFoundError("private_location", input.id);
    }

    const beforeParsed = selectPrivateLocationSchema.parse(existing);
    if (beforeParsed.status === input.status) {
      return beforeParsed;
    }

    const row = await tx
      .update(privateLocation)
      .set({ status: input.status, updatedAt: new Date() })
      .where(
        and(
          eq(privateLocation.id, input.id),
          eq(privateLocation.workspaceId, ctx.workspace.id),
        ),
      )
      .returning()
      .get();

    if (!row) throw new NotFoundError("private_location", input.id);

    const afterParsed = selectPrivateLocationSchema.parse(row);

    await emitAudit(tx, ctx, {
      action: "private_location.update",
      entityType: "private_location",
      entityId: afterParsed.id,
      before: beforeParsed,
      after: afterParsed,
    });

    return afterParsed;
  });
}
