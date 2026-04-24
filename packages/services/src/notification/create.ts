import { count, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
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
  const input = CreateNotificationInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    // Plan gate on notification count.
    const existing = await tx
      .select({ count: count() })
      .from(notification)
      .where(eq(notification.workspaceId, ctx.workspace.id))
      .get();
    if (
      existing &&
      existing.count >= ctx.workspace.limits["notification-channels"]
    ) {
      throw new LimitExceededError(
        "notification-channels",
        ctx.workspace.limits["notification-channels"],
      );
    }

    // Plan gate on provider (sms / pagerduty / opsgenie / …).
    assertProviderAllowed(ctx.workspace, input.provider);

    validateNotificationData(input.provider, input.data);

    const validatedMonitors = await validateMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitors,
    });

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
