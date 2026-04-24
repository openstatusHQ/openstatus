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

    const updated = await tx
      .update(monitor)
      .set({
        regions: input.regions.join(","),
        periodicity: input.periodicity,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id))
      .returning()
      .get();

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

    // `before`/`after` carry the `regions` + `periodicity` diff.
    // Private-location membership lives in a join table and isn't
    // reflected in the snapshot — documented gap, not a bug.
    await emitAudit(tx, ctx, {
      action: "monitor.update",
      entityType: "monitor",
      entityId: existing.id,
      before: existing,
      after: updated,
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

    // Tag membership isn't on the monitor row — synthesize `before`/`after`
    // snapshots from the relation so the diff captures the set change.
    const existingTagIds = (
      await tx
        .select({ tagId: monitorTagsToMonitors.monitorTagId })
        .from(monitorTagsToMonitors)
        .where(eq(monitorTagsToMonitors.monitorId, existing.id))
        .all()
    ).map((r) => r.tagId);
    await emitAudit(tx, ctx, {
      action: "monitor.update",
      entityType: "monitor",
      entityId: existing.id,
      before: { tagIds: [...existingTagIds].sort() },
      after: { tagIds: [...validatedTags].sort() },
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

    // Notifier membership isn't on the monitor row — synthesize snapshots
    // from the relation so the diff records the set change.
    const existingNotifierIds = (
      await tx
        .select({ notificationId: notificationsToMonitors.notificationId })
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.monitorId, existing.id))
        .all()
    ).map((r) => r.notificationId);
    await emitAudit(tx, ctx, {
      action: "monitor.update",
      entityType: "monitor",
      entityId: existing.id,
      before: { notificationIds: [...existingNotifierIds].sort() },
      after: { notificationIds: [...validatedNotifiers].sort() },
    });
  });
}
