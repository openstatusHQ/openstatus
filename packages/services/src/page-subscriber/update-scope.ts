import { and, eq, inArray } from "@openstatus/db";
import {
  pageComponent,
  pageSubscriber,
  pageSubscriberToPageComponent,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { resolveSubscriberByToken } from "./internal";
import { UpdateSubscriberScopeInput } from "./schemas";

/**
 * Replace a self-signup subscriber's component scope (the set of
 * components they receive notifications for). Token-addressed; the
 * subscriber acts on themselves, so the audit row is attributed to
 * `subscriber:{id}`.
 *
 * Component-only changes don't show up in `selectPageSubscriberSchema`
 * — `componentIds` is on the join table, not the row — so we surface
 * them via `metadata` to keep the audit row from being dropped by the
 * empty-diff guard in `emitAudit`.
 */
export async function updateSubscriberScope(args: {
  input: UpdateSubscriberScopeInput;
  db?: DB;
}): Promise<void> {
  const input = UpdateSubscriberScopeInput.parse(args.input);

  const resolved = await resolveSubscriberByToken({
    db: args.db,
    token: input.token,
    domain: input.domain,
  });
  if (!resolved) throw new NotFoundError("page_subscriber");
  const { row, pageData, components: currentIds } = resolved;

  if (!row.acceptedAt) {
    throw new ValidationError("Subscription not yet verified");
  }
  if (row.unsubscribedAt) {
    throw new ValidationError("Subscription is unsubscribed");
  }

  await withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    if (input.componentIds.length > 0) {
      const valid = await tx
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, row.pageId),
            inArray(pageComponent.id, input.componentIds),
          ),
        )
        .all();
      if (valid.length !== input.componentIds.length) {
        throw new ValidationError("Some components do not belong to this page");
      }
    }

    await tx
      .delete(pageSubscriberToPageComponent)
      .where(eq(pageSubscriberToPageComponent.pageSubscriberId, row.id))
      .run();

    if (input.componentIds.length > 0) {
      await tx
        .insert(pageSubscriberToPageComponent)
        .values(
          input.componentIds.map((id) => ({
            pageSubscriberId: row.id,
            pageComponentId: id,
          })),
        )
        .run();
    }

    const before = selectPageSubscriberSchema.parse(row);
    const updated = await tx
      .update(pageSubscriber)
      .set({ updatedAt: new Date() })
      .where(eq(pageSubscriber.id, row.id))
      .returning()
      .get();
    const after = selectPageSubscriberSchema.parse(updated ?? row);

    const auditCtx: ServiceContext = {
      workspace: pageData.workspace,
      actor: { type: "subscriber", subscriberId: row.id },
      db: tx,
    };
    const { token: _bt, ...beforeSnap } = before;
    const { token: _at, ...afterSnap } = after;

    // Sort defensively — the diff is order-sensitive for arrays, but the
    // semantic identity of the scope is set-equality, not list order.
    const previous = [...currentIds].sort((a, b) => a - b);
    const next = [...input.componentIds].sort((a, b) => a - b);
    const changed =
      previous.length !== next.length ||
      previous.some((id, i) => id !== next[i]);

    await emitAudit(tx, auditCtx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: row.id,
      before: beforeSnap,
      after: afterSnap,
      ...(changed
        ? { metadata: { previousComponentIds: previous, componentIds: next } }
        : {}),
    });
  });
}
