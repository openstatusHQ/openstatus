import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";

import type { PendingAction } from "./confirmation-store";
import type { SlackActor } from "./require-slack-member";

/**
 * Build a `ServiceContext` for a Slack-originated action. Loads the
 * workspace fresh since `PendingAction` only stores its id, and we want
 * services to see the latest plan/limits state at execution time.
 */
export async function toServiceCtx(args: {
  pending: PendingAction;
  actor: SlackActor;
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
  return {
    workspace: selectWorkspaceSchema.parse(row),
    actor: args.actor,
    requestId: args.requestId,
  };
}
