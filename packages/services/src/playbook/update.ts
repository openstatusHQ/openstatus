import { and, eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import {
  isBuiltinPlaybookSlug,
  playbookDefaultDescription,
  playbookDefaultTitle,
} from "@openstatus/db/src/schema/playbooks/constants";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError, NotFoundError } from "../errors";
import { getPlaybookBySlug, insertPlaybook, storedVariables } from "./internal";
import { UpdatePlaybookInput } from "./schemas";

/** Replaces a playbook's text and variables. A built-in slug is created on its first write. */
export async function updatePlaybook(args: {
  ctx: ServiceContext;
  input: UpdatePlaybookInput;
}): Promise<Playbook> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = UpdatePlaybookInput.parse(args.input);
  const variables = storedVariables(input.content, input.variables);

  return withTransaction(ctx, async (tx) => {
    const existing = await getPlaybookBySlug(tx, ctx.workspace.id, input.slug);
    if (
      input.expectedUpdatedAt &&
      existing?.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
    ) {
      throw new ConflictError(
        `The ${input.slug} playbook was changed since you loaded it. Load it again and reapply your change.`,
      );
    }
    if (!existing) {
      if (!isBuiltinPlaybookSlug(input.slug)) {
        throw new NotFoundError("playbook", input.slug);
      }
      // the defaults are stored, so a later change to them never reaches the row
      const created = await insertPlaybook(tx, ctx, {
        slug: input.slug,
        title: input.title ?? playbookDefaultTitle(input.slug),
        description:
          input.description ?? playbookDefaultDescription(input.slug),
        content: input.content,
        variables,
      });
      await emitAudit(tx, ctx, {
        action: "playbook.create",
        entityType: "playbook",
        entityId: created.id,
        after: created,
      });
      return created;
    }

    const title = input.title ?? existing.title;
    const description = input.description ?? existing.description;
    if (
      existing.title === title &&
      existing.description === description &&
      existing.content === input.content &&
      JSON.stringify(existing.variables) === JSON.stringify(variables)
    ) {
      return existing;
    }

    const updated = await tx
      .update(playbook)
      .set({
        title,
        description,
        content: input.content,
        variables,
        updatedBy: tryGetActorUserId(ctx.actor),
        // stored in seconds: always later than the last write, so a stale expectedUpdatedAt never matches
        updatedAt: new Date(
          Math.max(Date.now(), existing.updatedAt.getTime() + 1000),
        ),
      })
      .where(
        and(
          eq(playbook.id, existing.id),
          eq(playbook.workspaceId, ctx.workspace.id),
        ),
      )
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "playbook.update",
      entityType: "playbook",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    return updated;
  });
}
