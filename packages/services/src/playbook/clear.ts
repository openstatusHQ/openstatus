import { eq } from "@openstatus/db";
import { playbook } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { getPlaybookOfType } from "./internal";
import { PlaybookTypeInput } from "./schemas";

/** Empties the slot. The audit row keeps the removed content. */
export async function clearPlaybook(args: {
  ctx: ServiceContext;
  input: PlaybookTypeInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = PlaybookTypeInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPlaybookOfType(tx, ctx.workspace.id, input.type);
    if (!existing) throw new NotFoundError("playbook", input.type);
    await tx.delete(playbook).where(eq(playbook.id, existing.id));
    await emitAudit(tx, ctx, {
      action: "playbook.delete",
      entityType: "playbook",
      entityId: existing.id,
      before: existing,
    });
  });
}
