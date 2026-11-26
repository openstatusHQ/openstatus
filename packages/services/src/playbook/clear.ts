import { eq } from "@openstatus/db";
import { playbook } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { getPlaybookBySlug } from "./internal";
import { PlaybookSlugInput } from "./schemas";

/** Empties the slot. The audit row keeps the removed content. */
export async function clearPlaybook(args: {
  ctx: ServiceContext;
  input: PlaybookSlugInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = PlaybookSlugInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPlaybookBySlug(tx, ctx.workspace.id, input.slug);
    if (!existing) throw new NotFoundError("playbook", input.slug);
    await tx.delete(playbook).where(eq(playbook.id, existing.id));
    await emitAudit(tx, ctx, {
      action: "playbook.delete",
      entityType: "playbook",
      entityId: existing.id,
      before: existing,
    });
  });
}
