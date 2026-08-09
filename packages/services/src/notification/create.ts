import {
  notification,
  notificationsToMonitors,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { assertWithinLimit } from "../limits";
import type { Notification } from "../types";
import {
  assertProviderAllowed,
  validateMonitorIds,
  validateNotificationData,
} from "./internal";
import { CreateNotificationInput } from "./schemas";

export async function createNotification(args: {
  ctx: ServiceContext;
  input: CreateNotificationInput;
}): Promise<Notification> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreateNotificationInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    // Ownership before quota: a cross-workspace monitor must fail with
    // ForbiddenError regardless of the workspace's notification count.
    const validatedMonitors = await validateMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitors,
    });

    // Plan gate on notification count.
    await assertWithinLimit({
      tx,
      workspaceId: ctx.workspace.id,
      limit: "notification-channels",
    });

    // Plan gate on provider (sms / pagerduty / opsgenie / …).
    assertProviderAllowed(ctx.workspace, input.provider);

    validateNotificationData(input.provider, input.data);

    const row = await tx
      .insert(notification)
      .values({
        name: input.name,
        provider: input.provider,
        data: JSON.stringify(input.data),
        workspaceId: ctx.workspace.id,
      })
      .returning()
      .get();

    if (validatedMonitors.length > 0) {
      await tx.insert(notificationsToMonitors).values(
        validatedMonitors.map((monitorId) => ({
          notificationId: row.id,
          monitorId,
        })),
      );
    }

    await emitAudit(tx, ctx, {
      action: "notification.create",
      entityType: "notification",
      entityId: row.id,
      after: row,
    });

    return selectNotificationSchema.parse(row);
  });
}
