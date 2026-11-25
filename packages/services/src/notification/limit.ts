import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { countWorkspaceUsage } from "../limits";

export type NotificationLimit = {
  currentCount: number;
  maxCount: number;
  limitReached: boolean;
};

export async function getNotificationLimit(args: {
  ctx: ServiceContext;
}): Promise<NotificationLimit> {
  const { ctx } = args;
  requireScope(ctx, "notifications:read");
  const maxCount = ctx.workspace.limits["notification-channels"];
  const currentCount = await countWorkspaceUsage(
    ctx.workspace.id,
    "notification-channels",
    { db: ctx.db },
  );
  return { currentCount, maxCount, limitReached: currentCount >= maxCount };
}
