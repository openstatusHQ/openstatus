import { and, eq } from "@openstatus/db";
import { playbook } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { getPlaybookBySlug } from "./internal";
import { DeletePlaybookInput } from "./schemas";

/** The audit row keeps the removed content. */
export async function deletePlaybook(args: {
  ctx: ServiceContext;
  input: DeletePlaybookInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = DeletePlaybookInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPlaybookBySlug(tx, ctx.workspace.id, input.slug);
    if (!existing) throw new NotFoundError("playbook", input.slug);
    await tx
      .delete(playbook)
      .where(
        and(
          eq(playbook.id, existing.id),
          eq(playbook.workspaceId, ctx.workspace.id),
        ),
      );
    await emitAudit(tx, ctx, {
      action: "playbook.delete",
      entityType: "playbook",
      entityId: existing.id,
      before: existing,
    });
  });
}
