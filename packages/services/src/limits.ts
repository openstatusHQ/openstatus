import { eq } from "@openstatus/db";
import {
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
export type LimitKey =
  | "monitors"
  | "status-pages"
  | "page-components"
  | "notification-channels"
  | "synthetic-checks";

/**
 * Count currently-used resources of `limit` kind for the given workspace.
 * Cases are filled in per-domain migration PR. Unknown keys throw — the default
 * branch is a drift signal: a new LimitKey was added without a counter.
 */
async function countCurrent(
  _tx: DB,
  _workspaceId: number,
  limit: LimitKey,
): Promise<number> {
  switch (limit) {
    // Per-domain cases land in PR 1+ as each domain migrates.
    default:
      throw new Error(
        `assertWithinLimit: counter for "${limit}" not implemented. Add a case in countCurrent in packages/services/src/limits.ts.`,
      );
  }
}

export async function assertWithinLimit(args: {
  tx: DB;
  workspaceId: number;
  limit: LimitKey;
  delta?: number;
}): Promise<void> {
  const { tx, workspaceId, limit, delta = 1 } = args;

  const row = await tx
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .get();
  if (!row) throw new NotFoundError("workspace", workspaceId);

  const fresh = selectWorkspaceSchema.parse(row);
  const max = fresh.limits[limit];
  if (typeof max !== "number") {
    throw new Error(
      `assertWithinLimit: limit "${limit}" resolved to non-numeric value`,
    );
  }

  const count = await countCurrent(tx, workspaceId, limit);
  if (count + delta > max) throw new LimitExceededError(limit, max);
}
