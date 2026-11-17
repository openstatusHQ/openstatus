import { and, eq } from "@openstatus/db";
import { pageComponent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import {
  maintenanceIdsBehind,
  syncDerivedWindows,
} from "../maintenance/internal";
import { DeletePageComponentInput } from "./schemas";

/**
 * Hard-delete a page component. Cascade clears
 * `status_report_to_page_component` / `maintenance_to_page_component`
 * (FK cascade delete on the join tables); maintenances that lose a monitor
 * re-derive their window.
 */
export async function deletePageComponent(args: {
  ctx: ServiceContext;
  input: DeletePageComponentInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "pages:write");
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

    const maintenanceIds = await maintenanceIdsBehind(tx, ctx.workspace.id, {
      componentIds: [existing.id],
    });
    await tx.delete(pageComponent).where(eq(pageComponent.id, existing.id));
    await syncDerivedWindows(tx, ctx, maintenanceIds);

    await emitAudit(tx, ctx, {
      action: "page_component.delete",
      entityType: "page_component",
      entityId: existing.id,
      before: existing,
    });
  });
}
