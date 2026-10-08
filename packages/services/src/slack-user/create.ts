import { and, eq } from "@openstatus/db";
import { type SlackUser, slackUser } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ForbiddenError } from "../errors";
import { getMembership } from "../member/membership";
import { deleteSlackUserMappings } from "./internal";
import { CreateSlackUserMappingInput } from "./schemas";

/** Link a Slack user to a workspace member; re-linking replaces the old row. */
export async function createSlackUserMapping(args: {
  ctx: ServiceContext;
  input: CreateSlackUserMappingInput;
}): Promise<SlackUser> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreateSlackUserMappingInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const membership = await getMembership(tx, input.userId, ctx.workspace.id);
    if (!membership) {
      throw new ForbiddenError("User is not a member of this workspace");
    }

    const existing = await tx
      .select()
      .from(slackUser)
      .where(
        and(
          eq(slackUser.workspaceId, ctx.workspace.id),
          eq(slackUser.slackTeamId, input.teamId),
          eq(slackUser.slackUserId, input.slackUserId),
        ),
      )
      .get();
    if (existing?.userId === input.userId) return existing;
    if (existing) {
      await deleteSlackUserMappings({ tx, ctx, where: { id: existing.id } });
    }

    const record = await tx
      .insert(slackUser)
      .values({
        workspaceId: ctx.workspace.id,
        slackTeamId: input.teamId,
        slackUserId: input.slackUserId,
        userId: input.userId,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "slack_user.create",
      entityType: "slack_user",
      entityId: record.id,
      after: record,
    });
    return record;
  });
}
