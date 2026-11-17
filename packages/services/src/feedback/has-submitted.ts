import { and, eq } from "@openstatus/db";
import { feedback } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";
import { HasSubmittedFeedbackInput } from "./schemas";

/** Per user across workspaces, so a one-time prompt asks only until answered once. */
export async function hasSubmittedFeedback(args: {
  ctx: ServiceContext;
  input: HasSubmittedFeedbackInput;
}): Promise<boolean> {
  const { ctx } = args;
  const input = HasSubmittedFeedbackInput.parse(args.input);
  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) return false;

  const row = await getReadDb(ctx)
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), eq(feedback.source, input.source)))
    .get();
  return row !== undefined;
}
