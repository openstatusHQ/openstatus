import { and, count, eq, gte, isNull } from "@openstatus/db";
import {
  monitor,
  monitorRun,
  notification,
  page,
  pageComponent,
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";

import type { DB } from "./context";
import { LimitExceededError, NotFoundError } from "./errors";

/**
 * Re-exported plan-defaults lookup. For per-workspace overrides, read
 * `ctx.workspace.limits` directly (already parsed by selectWorkspaceSchema).
 */
export const getPlanLimits = getLimits;

// Count-style limits — the subset of Plan Limits that represent numeric row
// counts enforceable via COUNT(*) + delta. Heterogeneous fields (booleans,
// arrays, "Unlimited"|number) are intentionally excluded.
export const LIMIT_KEYS = [
  "monitors",
  "status-pages",
  "page-components",
  "notification-channels",
  "synthetic-checks",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

/**
 * Start of the rolling window `synthetic-checks` is metered over. Returns
 * both forms from one call so they can't drift by the milliseconds between
 * two `new Date()`s: drizzle converts the `Date` for `monitor_run.created_at`
 * (a seconds-mode column), while raw SQL has to pass the epoch seconds itself.
 */
export function syntheticChecksWindowStart(): { date: Date; seconds: number } {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return { date, seconds: Math.floor(date.getTime() / 1000) };
}

/** Runs a workspace has spent since `since`. */
export async function countSyntheticChecksSince(
  tx: DB,
  workspaceId: number,
  since: Date,
): Promise<number> {
  const row = await tx
    .select({ count: count() })
    .from(monitorRun)
    .where(
      and(
        eq(monitorRun.workspaceId, workspaceId),
        gte(monitorRun.createdAt, since),
      ),
    )
    .get();
  return row?.count ?? 0;
}

/**
 * Read one numeric cap straight from the workspace row, so a plan change or
 * purchased add-on committed mid-request wins over the caller's snapshot.
 */
export async function getWorkspaceLimit(
  tx: DB,
  workspaceId: number,
  limit: LimitKey,
): Promise<number> {
  const row = await tx
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .get();
  if (!row) throw new NotFoundError("workspace", workspaceId);

  const max = selectWorkspaceSchema.parse(row).limits[limit];
  if (typeof max !== "number") {
    throw new Error(
      `assertWithinLimit: limit "${limit}" resolved to non-numeric value`,
    );
  }
  return max;
}

/**
 * Count currently-used resources of `limit` kind for the given workspace.
 * The `default` branch is unreachable — `never` makes a new `LimitKey`
 * without a counter a compile error rather than a runtime surprise.
 */
async function countCurrent(
  tx: DB,
  workspaceId: number,
  limit: LimitKey,
): Promise<number> {
  switch (limit) {
    // Soft-deleted monitors don't consume quota; `active`/`status` are
    // irrelevant to the cap.
    case "monitors": {
      const row = await tx
        .select({ count: count() })
        .from(monitor)
        .where(
          and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)),
        )
        .get();
      return row?.count ?? 0;
    }
    case "status-pages": {
      const row = await tx
        .select({ count: count() })
        .from(page)
        .where(eq(page.workspaceId, workspaceId))
        .get();
      return row?.count ?? 0;
    }
    // Workspace-wide, not per-page: the cap spans every page in the
    // workspace (see `page-component/update-order`).
    case "page-components": {
      const row = await tx
        .select({ count: count() })
        .from(pageComponent)
        .where(eq(pageComponent.workspaceId, workspaceId))
        .get();
      return row?.count ?? 0;
    }
    case "notification-channels": {
      const row = await tx
        .select({ count: count() })
        .from(notification)
        .where(eq(notification.workspaceId, workspaceId))
        .get();
      return row?.count ?? 0;
    }
    // Usage over a rolling month, not a row count: `monitor_run` is
    // append-only, so runs of since-deleted monitors still count.
    case "synthetic-checks":
      return countSyntheticChecksSince(
        tx,
        workspaceId,
        syntheticChecksWindowStart().date,
      );
    default: {
      const unhandled: never = limit;
      throw new Error(
        `assertWithinLimit: counter for "${unhandled}" not implemented. Add a case in countCurrent in packages/services/src/limits.ts.`,
      );
    }
  }
}

export async function assertWithinLimit(args: {
  tx: DB;
  workspaceId: number;
  limit: LimitKey;
  delta?: number;
}): Promise<void> {
  const { tx, workspaceId, limit, delta = 1 } = args;

  const max = await getWorkspaceLimit(tx, workspaceId, limit);
  const current = await countCurrent(tx, workspaceId, limit);
  if (current + delta > max) {
    throw new LimitExceededError(limit, max, current);
  }
}
