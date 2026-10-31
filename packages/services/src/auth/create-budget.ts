import { and, count, eq, gte, inArray } from "@openstatus/db";
import { auditLog } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { PreconditionFailedError } from "../errors";

const HOUR_MS = 60 * 60_000;

// Only the resources the setup tools create; incident comms must not eat the budget.
const BUDGETED_ACTIONS = [
  "monitor.create",
  "page.create",
  "page_component.create",
];

/**
 * Per-credential cap on creates over the last hour, counted from the audit
 * log. MCP has no session, so this is what stops a looping agent; other
 * actors are untouched.
 */
export async function assertCreateBudget(
  ctx: ServiceContext,
  opts: { perHour?: number } = {},
): Promise<void> {
  const { actor } = ctx;
  if (actor.type !== "mcp") return;
  const perHour = opts.perHour ?? 30;

  const row = await getReadDb(ctx)
    .select({ count: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.workspaceId, ctx.workspace.id),
        eq(auditLog.actorType, "mcp"),
        eq(auditLog.actorId, actor.keyId),
        inArray(auditLog.action, BUDGETED_ACTIONS),
        gte(auditLog.createdAt, new Date(Date.now() - HOUR_MS)),
      ),
    )
    .get();

  if ((row?.count ?? 0) >= perHour) {
    throw new PreconditionFailedError(
      `Create budget reached: this credential may create at most ${perHour} resources per hour. Try again later.`,
    );
  }
}
