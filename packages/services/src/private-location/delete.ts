import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { DeletePrivateLocationInput } from "./schemas";

/**
 * Delete a private location. Idempotent — missing rows (wrong id, wrong
 * workspace, already deleted) succeed silently, matching the legacy
 * router's transactional DELETE-without-SELECT behaviour.
 *
 * `private_location_to_monitor` has ON DELETE CASCADE, so the join rows
 * drop automatically.
 */
export async function deletePrivateLocation(args: {
  ctx: ServiceContext;
  input: DeletePrivateLocationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeletePrivateLocationInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(privateLocation)
      .where(
        and(
          eq(privateLocation.id, input.id),
          eq(privateLocation.workspaceId, ctx.workspace.id),
        ),
      )
      .returning();

    if (!deleted) return;

    const parsed = selectPrivateLocationSchema.parse(deleted);
    await emitAudit(tx, ctx, {
      action: "private_location.delete",
      entityType: "private_location",
      entityId: parsed.id,
      before: parsed,
    });
  });
}
