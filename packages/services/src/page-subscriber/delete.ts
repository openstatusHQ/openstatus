import { and, eq } from "@openstatus/db";
import {
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { loadPageForWorkspace } from "./internal";
import { DeletePageSubscriberInput } from "./schemas";

/**
 * Hard-delete a subscriber row from the dashboard. Page must belong to
 * the caller's workspace and the subscriber must belong to that page;
 * both are strict (no silent success), matching the legacy router.
 */
export async function deletePageSubscriber(args: {
  ctx: ServiceContext;
  input: DeletePageSubscriberInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeletePageSubscriberInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await loadPageForWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    const [deleted] = await tx
      .delete(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.id, input.id),
          eq(pageSubscriber.pageId, input.pageId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundError("page_subscriber", input.id);
    }

    const parsed = selectPageSubscriberSchema.parse(deleted);
    const { token: _token, ...before } = parsed;
    await emitAudit(tx, ctx, {
      action: "page_subscriber.delete",
      entityType: "page_subscriber",
      entityId: parsed.id,
      before,
    });
  });
}
