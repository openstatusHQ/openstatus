import { and, eq, isNull, sql } from "@openstatus/db";
import {
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { loadPageForWorkspace } from "./internal";
import { UnsubscribePageSubscriberInput } from "./schemas";

/**
 * Unsubscribe on behalf of a workspace operator. Distinct from
 * `unsubscribeSubscriber`, which is addressed by the subscriber's own
 * token and carries a `subscriber` actor.
 *
 * Email lookup matches only still-subscribed email rows (an address can
 * recur once unsubscribed); id lookup takes the row as-is and is
 * idempotent on an already-unsubscribed row.
 */
export async function unsubscribePageSubscriber(args: {
  ctx: ServiceContext;
  input: UnsubscribePageSubscriberInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UnsubscribePageSubscriberInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await loadPageForWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    const where =
      input.identifier.type === "email"
        ? and(
            eq(pageSubscriber.pageId, input.pageId),
            sql`LOWER(${pageSubscriber.email}) = ${input.identifier.value}`,
            eq(pageSubscriber.channelType, "email"),
            isNull(pageSubscriber.unsubscribedAt),
          )
        : and(
            eq(pageSubscriber.pageId, input.pageId),
            eq(pageSubscriber.id, input.identifier.value),
          );

    const existing = await tx.select().from(pageSubscriber).where(where).get();
    if (!existing) {
      throw new NotFoundError("page_subscriber", input.identifier.value);
    }

    const updated = await tx
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(pageSubscriber.id, existing.id))
      .returning()
      .get();

    const { token: _bt, ...before } =
      selectPageSubscriberSchema.parse(existing);
    const { token: _at, ...after } = selectPageSubscriberSchema.parse(updated);
    await emitAudit(tx, ctx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: existing.id,
      before,
      after,
    });
  });
}
