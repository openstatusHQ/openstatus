import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor, notification } from "@openstatus/db/src/schema";
import {
  NotificationDataSchema,
  type NotificationProvider,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "../errors";
import type { Workspace } from "../types";
import type { NotificationDataInput } from "./schemas";

/** Load a notification by id, scoped to the workspace. Throws on miss. */
export async function getNotificationInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(notification)
    .where(
      and(eq(notification.id, id), eq(notification.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("notification", id);
  return row;
}

/** Validate that monitor ids exist and belong to the workspace (not soft-deleted). */
export async function validateMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const { tx, workspaceId, monitorIds } = args;
  if (monitorIds.length === 0) return [];
  const ids = Array.from(new Set(monitorIds));
  const rows = await tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  const valid = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!valid.has(id)) {
      throw new ForbiddenError(`Monitor ${id} is not accessible.`);
    }
  }
  return ids;
}

/**
 * Providers gated behind plan flags. The workspace plan must have the flag
 * enabled for the service to accept a `new`/`update` referencing that
 * provider. `email`, `slack`, `discord`, `webhook`, `telegram`, `ntfy`,
 * `google-chat` are always allowed by the existing UI.
 */
const PLAN_GATED_PROVIDERS = [
  "sms",
  "pagerduty",
  "opsgenie",
  "grafana-oncall",
  "whatsapp",
] as const satisfies ReadonlyArray<NotificationProvider>;

type PlanGatedProvider = (typeof PLAN_GATED_PROVIDERS)[number];

function isPlanGated(provider: string): provider is PlanGatedProvider {
  return (PLAN_GATED_PROVIDERS as ReadonlyArray<string>).includes(provider);
}

export function assertProviderAllowed(
  workspace: Workspace,
  provider: NotificationProvider,
): void {
  if (!isPlanGated(provider)) return;
  const allowed = workspace.limits[provider];
  if (!allowed) {
    throw new LimitExceededError(provider, 0);
  }
}

/** Validate the loose `data` payload against the canonical channel schema. */
export function validateNotificationData(data: NotificationDataInput): void {
  const parsed = NotificationDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError("Invalid notification data.", parsed.error);
  }
}
