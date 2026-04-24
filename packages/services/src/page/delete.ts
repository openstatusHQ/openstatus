import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { getPageInWorkspace } from "./internal";
import { DeletePageInput } from "./schemas";

/** Delete a page. FK cascade clears pageComponents / statusReports / … */
export async function deletePage(args: {
  ctx: ServiceContext;
  input: DeletePageInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeletePageInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getPageInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(page).where(eq(page.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page.delete",
      entityType: "page",
      entityId: existing.id,
      before: existing,
    });
  });
}
