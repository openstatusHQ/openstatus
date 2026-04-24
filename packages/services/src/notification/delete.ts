import { eq } from "@openstatus/db";
import { notification } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { getNotificationInWorkspace } from "./internal";
import { DeleteNotificationInput } from "./schemas";

/**
 * Hard-delete a notification row. Cascade clears
 * `notifications_to_monitors` associations (FK cascade delete on the table).
 */
export async function deleteNotification(args: {
  ctx: ServiceContext;
  input: DeleteNotificationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteNotificationInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getNotificationInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(notification).where(eq(notification.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "notification.delete",
      entityType: "notification",
      entityId: existing.id,
      before: existing,
    });
  });
}
