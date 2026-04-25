import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  privateLocationToMonitors,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import type { PrivateLocation } from "../types";
import { assertMonitorsInWorkspace } from "./internal";
import { UpdatePrivateLocationInput } from "./schemas";

/**
 * Replace the name and monitor associations of a private location.
 *
 * `updatedAt` is set explicitly — same as the legacy router.
 * Associations are bulk-replaced: delete-all followed by insert-all for
 * the new set. The delete is unconditional inside the workspace-scoped
 * tx, so there's no opportunity for a stale row to leak through.
 */
export async function updatePrivateLocation(args: {
  ctx: ServiceContext;
  input: UpdatePrivateLocationInput;
}): Promise<PrivateLocation> {
  const { ctx } = args;
  const input = UpdatePrivateLocationInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await tx.query.privateLocation.findFirst({
      where: and(
        eq(privateLocation.id, input.id),
        eq(privateLocation.workspaceId, ctx.workspace.id),
      ),
      with: {
        privateLocationToMonitors: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("private_location", input.id);
    }

    await assertMonitorsInWorkspace({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitors,
    });

    const row = await tx
      .update(privateLocation)
      .set({ name: input.name, updatedAt: new Date() })
      .where(
        and(
          eq(privateLocation.id, input.id),
          eq(privateLocation.workspaceId, ctx.workspace.id),
        ),
      )
      .returning()
      .get();

    await tx
      .delete(privateLocationToMonitors)
      .where(eq(privateLocationToMonitors.privateLocationId, row.id));

    if (input.monitors.length > 0) {
      await tx.insert(privateLocationToMonitors).values(
        input.monitors.map((monitorId) => ({
          privateLocationId: row.id,
          monitorId,
        })),
      );
    }

    const { privateLocationToMonitors: beforeLinks, ...beforeRow } = existing;
    const beforeParsed = selectPrivateLocationSchema.parse(beforeRow);
    const afterParsed = selectPrivateLocationSchema.parse(row);

    await emitAudit(tx, ctx, {
      action: "private_location.update",
      entityType: "private_location",
      entityId: afterParsed.id,
      before: {
        ...beforeParsed,
        monitorIds: beforeLinks
          .map((l) => l.monitorId)
          .filter((id): id is number => id !== null)
          .sort((a, b) => a - b),
      },
      after: {
        ...afterParsed,
        monitorIds: [...input.monitors].sort((a, b) => a - b),
      },
    });

    return afterParsed;
  });
}
