import { eq } from "@openstatus/db";
import { feedback, user } from "@openstatus/db/src/schema";
import type { Feedback } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { InternalServiceError, PreconditionFailedError } from "../errors";
import { SubmitFeedbackInput } from "./schemas";
import { postFeedbackToSlack } from "./slack";

// Feedback is addressed to openstatus, not workspace configuration, and the
// audit action union has no `feedback` verb.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function submitFeedback(args: {
  ctx: ServiceContext;
  input: SubmitFeedbackInput;
  slackWebhookUrl?: string;
}): Promise<Feedback> {
  const { ctx } = args;
  requireScope(ctx, "any");
  const input = SubmitFeedbackInput.parse(args.input);

  // `feedback.user_id` is NOT NULL: legacy Unkey keys and the super-admin
  // token carry no user.
  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new PreconditionFailedError(
      "Feedback requires a credential linked to a user. Use OAuth or an API key created in the dashboard.",
    );
  }

  const stored = await withTransaction(ctx, async (tx) => {
    const row = await tx
      .insert(feedback)
      .values({
        workspaceId: ctx.workspace.id,
        userId,
        source: input.source,
        message: input.message,
        type: input.type,
        blocker: input.blocker,
        path: input.path,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning()
      .get();
    if (!row) throw new InternalServiceError("Failed to store feedback");

    const author = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .get();

    return { row, userEmail: author?.email ?? null };
  });

  // After the transaction, so a slow webhook never holds the write lock.
  await postFeedbackToSlack({
    webhookUrl: args.slackWebhookUrl,
    message: stored.row.message,
    fields: [
      ["Source", stored.row.source],
      ["Type", stored.row.type],
      ["Blocker", stored.row.blocker],
      ["User", stored.userEmail],
      ["Workspace", ctx.workspace.slug],
      ["Path", stored.row.path],
      ...Object.entries(input.metadata ?? {}),
    ],
  });

  return stored.row;
}
