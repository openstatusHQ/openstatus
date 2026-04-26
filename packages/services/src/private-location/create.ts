import {
  privateLocation,
  privateLocationToMonitors,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import type { PrivateLocation } from "../types";
import { assertMonitorsInWorkspace } from "./internal";
import { CreatePrivateLocationInput } from "./schemas";

/**
 * Create a private location and attach it to the given monitors.
 *
 * `token` is audited as part of the `after` snapshot because private-
 * location tokens are workspace-scoped agent credentials visible in the
 * dashboard UI — treating them as "secret" in the audit log but plain-text
 * in the settings screen would be inconsistent. If that ever changes,
 * strip it here the way invitation tokens are stripped.
 */
export async function createPrivateLocation(args: {
  ctx: ServiceContext;
  input: CreatePrivateLocationInput;
}): Promise<PrivateLocation> {
  const { ctx } = args;
  const input = CreatePrivateLocationInput.parse(args.input);

  // The pivot table has no UNIQUE (private_location_id, monitor_id)
  // constraint, so duplicate input ids would silently produce duplicate
  // FK rows. Dedupe before insert; the audit snapshot follows suit.
  const monitorIds = Array.from(new Set(input.monitors));

  return withTransaction(ctx, async (tx) => {
    await assertMonitorsInWorkspace({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds,
    });

    const row = await tx
      .insert(privateLocation)
      .values({
        name: input.name,
        token: input.token,
        workspaceId: ctx.workspace.id,
      })
      .returning()
      .get();

    if (monitorIds.length > 0) {
      await tx.insert(privateLocationToMonitors).values(
        monitorIds.map((monitorId) => ({
          privateLocationId: row.id,
          monitorId,
        })),
      );
    }

    const parsed = selectPrivateLocationSchema.parse(row);
    await emitAudit(tx, ctx, {
      action: "private_location.create",
      entityType: "private_location",
      entityId: parsed.id,
      after: { ...parsed, monitorIds },
    });

    return parsed;
  });
}
