import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  privateLocationToMonitors,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import type { PrivateLocation } from "../types";
import { assertMonitorsInWorkspace } from "./internal";
import { UpdatePrivateLocationInput } from "./schemas";

/**
 * Patch a private location. Omitted fields are left untouched; passing an
 * empty `monitors` array clears every association.
 */
export async function updatePrivateLocation(args: {
  ctx: ServiceContext;
  input: UpdatePrivateLocationInput;
}): Promise<PrivateLocation> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdatePrivateLocationInput.parse(args.input);

  // The pivot table has no UNIQUE (private_location_id, monitor_id)
  // constraint, so duplicate input ids would silently produce duplicate
  // FK rows. Dedupe before insert; the audit snapshot follows suit.
  const monitorIds = input.monitors
    ? Array.from(new Set(input.monitors))
    : undefined;

  const metadataUpdate =
    input.metadata !== undefined
      ? { metadata: Object.keys(input.metadata).length ? input.metadata : null }
      : undefined;

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

    if (monitorIds) {
      await assertMonitorsInWorkspace({
        tx,
        workspaceId: ctx.workspace.id,
        monitorIds,
      });
    }

    const row = await tx
      .update(privateLocation)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...metadataUpdate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(privateLocation.id, input.id),
          eq(privateLocation.workspaceId, ctx.workspace.id),
        ),
      )
      .returning()
      .get();

    // Drizzle's `.returning().get()` is typed `T | undefined`. The
    // `findFirst` above guarantees the row exists in this tx, but a
    // future change to the WHERE could silently drop the row and the
    // next line would crash with `Cannot read property 'id' of
    // undefined`. Re-throw NotFound so the failure mode stays sane.
    if (!row) throw new NotFoundError("private_location", input.id);

    if (monitorIds) {
      await tx
        .delete(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, row.id));

      if (monitorIds.length > 0) {
        await tx.insert(privateLocationToMonitors).values(
          monitorIds.map((monitorId) => ({
            privateLocationId: row.id,
            monitorId,
          })),
        );
      }
    }

    const { privateLocationToMonitors: beforeLinks, ...beforeRow } = existing;
    const beforeParsed = selectPrivateLocationSchema.parse(beforeRow);
    const afterParsed = selectPrivateLocationSchema.parse(row);

    const beforeMonitorIds = beforeLinks
      .map((l) => l.monitorId)
      .filter((id): id is number => id !== null)
      .sort((a, b) => a - b);

    await emitAudit(tx, ctx, {
      action: "private_location.update",
      entityType: "private_location",
      entityId: afterParsed.id,
      before: { ...beforeParsed, monitorIds: beforeMonitorIds },
      after: {
        ...afterParsed,
        monitorIds: monitorIds
          ? [...monitorIds].sort((a, b) => a - b)
          : beforeMonitorIds,
      },
    });

    return afterParsed;
  });
}
