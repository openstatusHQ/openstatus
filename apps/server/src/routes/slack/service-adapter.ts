import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import { type ServiceContext, ServiceError } from "@openstatus/services";
import { ZodError } from "zod";

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
 * Slack's UI is single-line plain text, so we surface actionable text only
 * and leave full error details to logtape/Sentry observability sinks.
 */
export function toSlackMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return ":x: The request was invalid.";
  }
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "NOT_FOUND":
      case "FORBIDDEN":
      case "UNAUTHORIZED":
      case "CONFLICT":
      case "VALIDATION":
      case "LIMIT_EXCEEDED":
        return `:x: ${err.message}`;
      case "INTERNAL":
        return ":x: Something went wrong. Please try again.";
    }
  }
  return ":x: Something went wrong. Please try again.";
}
