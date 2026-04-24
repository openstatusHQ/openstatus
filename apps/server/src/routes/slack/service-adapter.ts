import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";

import type { PendingAction } from "./confirmation-store";

/**
 * Build a `ServiceContext` for a Slack-originated action. Loads the
 * workspace fresh since `PendingAction` only stores its id, and we want
 * services to see the latest plan/limits state at execution time.
 */
export async function toServiceCtx(args: {
  pending: PendingAction;
  slackUserId: string;
  teamId: string | undefined;
  requestId?: string;
}): Promise<ServiceContext> {
  const row = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, args.pending.workspaceId))
    .get();
  if (!row) {
    throw new Error(
      `slack: workspace ${args.pending.workspaceId} not found at action execute time`,
    );
  }
  const workspace = selectWorkspaceSchema.parse(row);
  return {
    workspace,
    actor: {
      type: "slack",
      teamId: args.teamId ?? "",
      slackUserId: args.slackUserId,
    },
    requestId: args.requestId,
  };
}

/**
 * Convert a service (or unknown) error into a Slack-friendly message.
 *
 * **Always returns the same generic string: `"Something went wrong.
 * Please try again."`** Slack users aren't developers — they don't need
 * (and shouldn't see) the specific error detail. The constraint is
 * codified by the `does not leak internal error details` test case and
 * was the existing pre-services behaviour we need to preserve. Full
 * error text still flows to logtape / Sentry via the catch site.
 *
 * Notable things this intentionally suppresses:
 *   - `NotFoundError` formats as `"<entity> <id> not found"` — internal
 *     row IDs have no meaning to Slack users.
 *   - `ConflictError` / `ValidationError` often carry SQL-ish phrasing
 *     or internal column names.
 *   - `ZodError` emits a raw JSON issue list.
 */
export function toSlackMessage(_err: unknown): string {
  return ":x: Something went wrong. Please try again.";
}
