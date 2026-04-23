import { maintenance } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import type { Maintenance } from "../types";
import {
  assertPageInWorkspace,
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "./internal";
import { CreateMaintenanceInput } from "./schemas";

export async function createMaintenance(args: {
  ctx: ServiceContext;
  input: CreateMaintenanceInput;
}): Promise<Maintenance> {
  const { ctx } = args;
  const input = CreateMaintenanceInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertPageInWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    const validated = await validatePageComponentIds({
      tx,
      workspaceId: ctx.workspace.id,
      pageComponentIds: input.pageComponentIds,
    });

    if (validated.pageId !== null && validated.pageId !== input.pageId) {
      throw new ConflictError(
        `pageId ${input.pageId} does not match the page (${validated.pageId}) of the selected components.`,
      );
    }

    const record = await tx
      .insert(maintenance)
      .values({
        workspaceId: ctx.workspace.id,
        pageId: input.pageId,
        title: input.title,
        message: input.message,
        from: input.from,
        to: input.to,
      })
      .returning()
      .get();

    await updatePageComponentAssociations({
      tx,
      maintenanceId: record.id,
      componentIds: validated.componentIds,
    });

    await emitAudit(tx, ctx, {
      action: "maintenance.create",
      entityType: "maintenance",
      entityId: record.id,
      after: record,
    });

    return record;
  });
}
