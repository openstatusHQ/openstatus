import { eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import { PLAYBOOK_MAX_CHARS } from "@openstatus/db/src/schema/playbooks/constants";
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
import { ValidationError } from "../errors";
import { getPlaybookOfType } from "./internal";
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

/** Writes the workspace's one playbook of this type, creating it when the slot is empty. */
export async function savePlaybook(args: {
  ctx: ServiceContext;
  input: SavePlaybookInput;
}): Promise<Playbook> {
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
    const existing = await getPlaybookOfType(tx, ctx.workspace.id, input.type);
    if (!existing) {
      const created = await tx
        .insert(playbook)
        .values({
          workspaceId: ctx.workspace.id,
          type: input.type,
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
      return created;
    }
    if (
      existing.content === input.content &&
      JSON.stringify(existing.variables) === JSON.stringify(variables)
    ) {
      return existing;
    }

    const updated = await tx
      .update(playbook)
      .set({
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
    return updated;
  });
}
