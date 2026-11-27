import { eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import {
  isBuiltinPlaybookSlug,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_MAX_CUSTOM,
  playbookDefaultDescription,
  playbookDefaultTitle,
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
import {
  ConflictError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { getPlaybookBySlug } from "./internal";
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

type WriteArgs = { ctx: ServiceContext; input: SavePlaybookInput };

/** Writes the workspace's one playbook of this slug, creating it when the slot is empty. */
export async function savePlaybook(args: WriteArgs): Promise<Playbook> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  return writePlaybook(args, "save");
}

/** Creates a custom playbook; a taken or built-in slug is refused. */
export async function createPlaybook(args: WriteArgs): Promise<Playbook> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  return writePlaybook(args, "create");
}

/** Replaces a playbook; only a built-in slug may be written for the first time. */
export async function updatePlaybook(args: WriteArgs): Promise<Playbook> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  return writePlaybook(args, "update");
}

// oxlint-disable-next-line openstatus/services-mutation-guards -- the three verbs above check the scope
async function writePlaybook(
  args: WriteArgs,
  mode: "save" | "create" | "update",
): Promise<Playbook> {
  const { ctx } = args;
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
    const builtin = isBuiltinPlaybookSlug(input.slug);
    if (mode === "create" && builtin) {
      throw new ValidationError(
        `${input.slug} is a built-in playbook; update it instead.`,
      );
    }
    if (mode === "create" && existing) {
      throw new ConflictError(`A ${input.slug} playbook already exists.`);
    }
    if (mode === "update" && !existing && !builtin) {
      throw new NotFoundError("playbook", input.slug);
    }
    // a default is only ever written on create, so later edits to it never reach the row
    const title =
      input.title ??
      existing?.title ??
      (builtin ? playbookDefaultTitle(input.slug) : "");
    const description =
      input.description ??
      existing?.description ??
      playbookDefaultDescription(input.slug);
    if (!title || !description) {
      throw new ValidationError(
        "A custom playbook needs a title and a description.",
      );
    }
    if (!existing) {
      if (!builtin) {
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
      return created;
    }
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
