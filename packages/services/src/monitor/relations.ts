import { eq } from "@openstatus/db";
import {
  monitor,
  monitorTagsToMonitors,
  notificationsToMonitors,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
import {
  getMonitorInWorkspace,
  validateNotificationIds,
  validatePrivateLocationIds,
  validateTagIds,
} from "./internal";
import {
  UpdateMonitorNotifiersInput,
  UpdateMonitorSchedulingRegionsInput,
  UpdateMonitorTagsInput,
} from "./schemas";

/**
 * Update the monitor's `regions` / `periodicity` + private-location set in
 * a single transaction. Enforces plan limits on periodicity, region count,
 * and individual region access.
 */
export async function updateMonitorSchedulingRegions(args: {
  ctx: ServiceContext;
  input: UpdateMonitorSchedulingRegionsInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorSchedulingRegionsInput.parse(args.input);
  const limits = ctx.workspace.limits;

  if (!limits.periodicity.includes(input.periodicity)) {
    throw new LimitExceededError("periodicity", limits.periodicity.length);
  }
  if (limits["max-regions"] < input.regions.length) {
    throw new LimitExceededError("max-regions", limits["max-regions"]);
  }
  if (
    input.regions.length > 0 &&
    !input.regions.every((r) =>
      limits.regions.includes(r as (typeof limits)["regions"][number]),
    )
  ) {
    throw new LimitExceededError("regions", limits.regions.length);
  }

  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const validatedLocations = await validatePrivateLocationIds({
      tx,
      workspaceId: ctx.workspace.id,
      privateLocationIds: input.privateLocations,
    });

    await tx
      .update(monitor)
      .set({
        regions: input.regions.join(","),
        periodicity: input.periodicity,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id));

    await tx
      .delete(privateLocationToMonitors)
      .where(eq(privateLocationToMonitors.monitorId, existing.id));
    if (validatedLocations.length > 0) {
      await tx.insert(privateLocationToMonitors).values(
        validatedLocations.map((privateLocationId) => ({
          monitorId: existing.id,
          privateLocationId,
        })),
      );
    }

    await emitAudit(tx, ctx, {
      action: "monitor.update_scheduling_regions",
      entityType: "monitor",
      entityId: existing.id,
      metadata: {
        regions: input.regions,
        periodicity: input.periodicity,
        privateLocationIds: validatedLocations,
      },
    });
  });
}

/** Replace the full monitor-tag association set. */
export async function updateMonitorTags(args: {
  ctx: ServiceContext;
  input: UpdateMonitorTagsInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorTagsInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    const validatedTags = await validateTagIds({
      tx,
      workspaceId: ctx.workspace.id,
      tagIds: input.tags,
    });

    await tx
      .delete(monitorTagsToMonitors)
      .where(eq(monitorTagsToMonitors.monitorId, existing.id));
    if (validatedTags.length > 0) {
      await tx.insert(monitorTagsToMonitors).values(
        validatedTags.map((tagId) => ({
          monitorId: existing.id,
          monitorTagId: tagId,
        })),
      );
    }

    await emitAudit(tx, ctx, {
      action: "monitor.update_tags",
      entityType: "monitor",
      entityId: existing.id,
      metadata: { tagIds: validatedTags },
    });
  });
}

/** Replace the full monitor-to-notification association set. */
export async function updateMonitorNotifiers(args: {
  ctx: ServiceContext;
  input: UpdateMonitorNotifiersInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorNotifiersInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    const validatedNotifiers = await validateNotificationIds({
      tx,
      workspaceId: ctx.workspace.id,
      notificationIds: input.notifiers,
    });

    await tx
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, existing.id));
    if (validatedNotifiers.length > 0) {
      await tx.insert(notificationsToMonitors).values(
        validatedNotifiers.map((notificationId) => ({
          monitorId: existing.id,
          notificationId,
        })),
      );
    }

    await emitAudit(tx, ctx, {
      action: "monitor.update_notifiers",
      entityType: "monitor",
      entityId: existing.id,
      metadata: { notificationIds: validatedNotifiers },
    });
  });
}
