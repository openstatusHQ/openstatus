import { eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import {
  isBuiltinPlaybookSlug,
  PLAYBOOK_MAX_CUSTOM,
} from "@openstatus/db/src/schema/playbooks/constants";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, LimitExceededError, ValidationError } from "../errors";
import { getPlaybookBySlug, insertPlaybook, storedVariables } from "./internal";
import { CreatePlaybookInput } from "./schemas";

/** Creates a custom playbook; a taken or built-in slug is refused. */
export async function createPlaybook(args: {
  ctx: ServiceContext;
  input: CreatePlaybookInput;
}): Promise<Playbook> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = CreatePlaybookInput.parse(args.input);
  if (isBuiltinPlaybookSlug(input.slug)) {
    throw new ValidationError(
      `${input.slug} is a built-in playbook; update it instead.`,
    );
  }
  const variables = storedVariables(input.content, input.variables);

  return withTransaction(ctx, async (tx) => {
    if (await getPlaybookBySlug(tx, ctx.workspace.id, input.slug)) {
      throw new ConflictError(`A ${input.slug} playbook already exists.`);
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
    const created = await insertPlaybook(tx, ctx, {
      slug: input.slug,
      title: input.title,
      description: input.description,
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
  });
}
