import { eq } from "@openstatus/db";
import { playbook } from "@openstatus/db/src/schema";
import {
  isBuiltinPlaybookSlug,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_MAX_CUSTOM,
} from "@openstatus/db/src/schema/playbooks/constants";
import {
  type PlaybookVariables,
  playbookVariableNames,
  renderPlaybook,
} from "@openstatus/db/src/schema/playbooks/variables";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import {
  getPlaybookBySlug,
  type PlaybookWithDefaults,
  withDefaults,
} from "./internal";
import { SavePlaybookInput } from "./schemas";

/** Keeps the non-empty values of variables the text uses, in order of use. */
function usedVariables(
  content: string,
  variables: PlaybookVariables | undefined,
): PlaybookVariables | null {
  const entries = playbookVariableNames(content).flatMap((name) => {
    const value = variables?.[name];
    return value ? [[name, value] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

/** Writes the workspace's one playbook of this slug, creating it when the slot is empty. */
export async function savePlaybook(args: {
  ctx: ServiceContext;
  input: SavePlaybookInput;
}): Promise<PlaybookWithDefaults> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = SavePlaybookInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);
  const variables = usedVariables(input.content, input.variables);
  if (renderPlaybook(input.content, variables).length > PLAYBOOK_MAX_CHARS) {
    throw new ValidationError(
      `A playbook is limited to ${PLAYBOOK_MAX_CHARS} characters with its variables filled in.`,
    );
  }

  return withTransaction(ctx, async (tx) => {
    const existing = await getPlaybookBySlug(tx, ctx.workspace.id, input.slug);
    const title =
      input.title === undefined
        ? (existing?.title ?? null)
        : input.title || null;
    const description =
      input.description === undefined
        ? (existing?.description ?? null)
        : input.description || null;
    if (!existing) {
      if (!isBuiltinPlaybookSlug(input.slug)) {
        if (!title) {
          throw new ValidationError("A custom playbook needs a title.");
        }
        const slugs = await tx
          .select({ slug: playbook.slug })
          .from(playbook)
          .where(eq(playbook.workspaceId, ctx.workspace.id))
          .all();
        const custom = slugs.filter((r) => !isBuiltinPlaybookSlug(r.slug));
        if (custom.length >= PLAYBOOK_MAX_CUSTOM) {
          throw new LimitExceededError(
            "custom-playbooks",
            PLAYBOOK_MAX_CUSTOM,
            custom.length,
          );
        }
      }
      const created = await tx
        .insert(playbook)
        .values({
          workspaceId: ctx.workspace.id,
          slug: input.slug,
          title,
          description,
          content: input.content,
          variables,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning()
        .get();
      await emitAudit(tx, ctx, {
        action: "playbook.create",
        entityType: "playbook",
        entityId: created.id,
        after: created,
      });
      return withDefaults(created);
    }
    if (
      existing.title === title &&
      existing.description === description &&
      existing.content === input.content &&
      JSON.stringify(existing.variables) === JSON.stringify(variables)
    ) {
      return withDefaults(existing);
    }

    const updated = await tx
      .update(playbook)
      .set({
        title,
        description,
        content: input.content,
        variables,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(playbook.id, existing.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "playbook.update",
      entityType: "playbook",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    return withDefaults(updated);
  });
}
