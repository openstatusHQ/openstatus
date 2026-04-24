import { eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import type { Notification } from "../types";
import {
  assertProviderAllowed,
  getNotificationInWorkspace,
  validateMonitorIds,
  validateNotificationData,
} from "./internal";
import { UpdateNotificationInput } from "./schemas";

export async function updateNotification(args: {
  ctx: ServiceContext;
  input: UpdateNotificationInput;
}): Promise<Notification> {
  const { ctx } = args;
  const input = UpdateNotificationInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getNotificationInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    // Re-check the plan gate against the stored provider. After a plan
    // downgrade a previously allowed channel (e.g. pagerduty) should no
    // longer be editable — matches the create-time gate.
    assertProviderAllowed(ctx.workspace, existing.provider);

    validateNotificationData(existing.provider, input.data);

    const validatedMonitors = await validateMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitors,
    });

    const updated = await tx
      .update(notification)
      .set({
        name: input.name,
        data: JSON.stringify(input.data),
        updatedAt: new Date(),
      })
      .where(eq(notification.id, existing.id))
      .returning()
      .get();

    await tx
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.notificationId, existing.id));
    if (validatedMonitors.length > 0) {
      await tx.insert(notificationsToMonitors).values(
        validatedMonitors.map((monitorId) => ({
          notificationId: existing.id,
          monitorId,
        })),
      );
    }

    await emitAudit(tx, ctx, {
      action: "notification.update",
      entityType: "notification",
      entityId: existing.id,
      before: existing,
      after: updated,
      metadata: { provider: existing.provider },
    });

    return selectNotificationSchema.parse(updated);
  });
}
