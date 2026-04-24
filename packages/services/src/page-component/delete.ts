import { and, eq } from "@openstatus/db";
import { pageComponent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { DeletePageComponentInput } from "./schemas";

/**
 * Hard-delete a page component. Cascade clears
 * `status_report_to_page_component` / `maintenance_to_page_component`
 * (FK cascade delete on the join tables).
 */
export async function deletePageComponent(args: {
  ctx: ServiceContext;
  input: DeletePageComponentInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeletePageComponentInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.id, input.id),
          eq(pageComponent.workspaceId, ctx.workspace.id),
        ),
      )
      .get();
    if (!existing) throw new NotFoundError("page_component", input.id);

    await tx.delete(pageComponent).where(eq(pageComponent.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page_component.delete",
      entityType: "page_component",
      entityId: existing.id,
      before: existing,
    });
  });
}
